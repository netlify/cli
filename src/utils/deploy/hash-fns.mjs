import { readFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'util'

import fromArray from 'from2-array'
import pumpModule from 'pump'

import { getPathInProject } from '../../lib/settings.mjs'
import { INTERNAL_FUNCTIONS_FOLDER } from '../functions/functions.mjs'

import { hasherCtor, manifestCollectorCtor } from './hasher-segments.mjs'

const pump = promisify(pumpModule)

// Maximum age of functions manifest (2 minutes).
const MANIFEST_FILE_TTL = 12e4

const getFunctionZips = async ({
  directories,
  functionsConfig,
  manifestPath,
  rootDir,
  skipFunctionsCache,
  statusCb,
  tmpDir,
}) => {
  statusCb({
    type: 'functions-manifest',
    msg: 'Looking for a functions cache...',
    phase: 'start',
  })

  if (manifestPath) {
    try {
      // read manifest.json file
      const { functions, timestamp } = JSON.parse(await readFile(manifestPath))
      const manifestAge = Date.now() - timestamp

      if (manifestAge > MANIFEST_FILE_TTL) {
        throw new Error('Manifest expired')
      }

      statusCb({
        type: 'functions-manifest',
        msg: 'Deploying functions from cache (use --skip-functions-cache to override)',
        phase: 'stop',
      })

      return functions
    } catch {
      statusCb({
        type: 'functions-manifest',
        msg: 'Ignored invalid or expired functions cache',
        phase: 'stop',
      })
    }
  } else {
    const msg = skipFunctionsCache
      ? 'Ignoring functions cache (use without --skip-functions-cache to change)'
      : 'No cached functions were found'

    statusCb({
      type: 'functions-manifest',
      msg,
      phase: 'stop',
    })
  }

  const { zipFunctions } = await import('@netlify/zip-it-and-ship-it')

  return await zipFunctions(directories, tmpDir, {
    basePath: rootDir,
    configFileDirectories: [getPathInProject([INTERNAL_FUNCTIONS_FOLDER])],
    config: functionsConfig,
  })
}

const hashFns = async (
  directories,
  {
    assetType = 'function',
    concurrentHash,
    functionsConfig,
    hashAlgorithm = 'sha256',
    manifestPath,
    rootDir,
    skipFunctionsCache,
    statusCb,
    tmpDir,
  },
) => {
  // Early out if no functions directories are configured.
  if (directories.length === 0) {
    return { functions: {}, functionsWithNativeModules: [], shaMap: {} }
  }

  if (!tmpDir) {
    throw new Error('Missing tmpDir directory for zipping files')
  }

  const functionZips = await getFunctionZips({
    directories,
    functionsConfig,
    manifestPath,
    rootDir,
    skipFunctionsCache,
    statusCb,
    tmpDir,
  })
  const fileObjs = functionZips.map(({ displayName, generator, path: functionPath, runtime }) => ({
    filepath: functionPath,
    root: tmpDir,
    relname: path.relative(tmpDir, functionPath),
    basename: path.basename(functionPath),
    extname: path.extname(functionPath),
    type: 'file',
    assetType: 'function',
    normalizedPath: path.basename(functionPath, path.extname(functionPath)),
    runtime,
    displayName,
    generator,
  }))
  const fnConfig = functionZips
    .filter((func) => Boolean(func.displayName || func.generator))
    .reduce(
      (funcs, curr) => ({ ...funcs, [curr.name]: { display_name: curr.displayName, generator: curr.generator } }),
      {},
    )
  const functionSchedules = functionZips
    .map(({ name, schedule }) => schedule && { name, cron: schedule })
    .filter(Boolean)
  const functionsWithNativeModules = functionZips.filter(
    ({ nativeNodeModules }) => nativeNodeModules !== undefined && Object.keys(nativeNodeModules).length !== 0,
  )

  const functionStream = fromArray.obj(fileObjs)

  const hasher = hasherCtor({ concurrentHash, hashAlgorithm })

  // Written to by manifestCollector
  // normalizedPath: hash (wanted by deploy API)
  const functions = {}
  // hash: [fileObj, fileObj, fileObj]
  const fnShaMap = {}
  const manifestCollector = manifestCollectorCtor(functions, fnShaMap, { statusCb, assetType })

  await pump(functionStream, hasher, manifestCollector)
  return { functionSchedules, functions, functionsWithNativeModules, fnShaMap, fnConfig }
}

export default hashFns
