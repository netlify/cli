import { readFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'util'

import { zipFunctions } from '@netlify/zip-it-and-ship-it'
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'from... Remove this comment to see the full error message
import fromArray from 'from2-array'
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'pump... Remove this comment to see the full error message
import pumpModule from 'pump'

import BaseCommand from '../../commands/base-command.js'
import { $TSFixMe } from '../../commands/types.js'
import { INTERNAL_FUNCTIONS_FOLDER } from '../functions/functions.js'

import { hasherCtor, manifestCollectorCtor } from './hasher-segments.js'

const pump = promisify(pumpModule)

// Maximum age of functions manifest (2 minutes).
const MANIFEST_FILE_TTL = 12e4

const getFunctionZips = async ({
  command,
  directories,
  functionsConfig,
  manifestPath,
  rootDir,
  skipFunctionsCache,
  statusCb,
  tmpDir,
}: {
  command: BaseCommand
  directories: string[]
  functionsConfig: $TSFixMe
  manifestPath: $TSFixMe
  rootDir: $TSFixMe
  skipFunctionsCache: $TSFixMe
  statusCb: $TSFixMe
  tmpDir: $TSFixMe
}) => {
  statusCb({
    type: 'functions-manifest',
    msg: 'Looking for a functions cache...',
    phase: 'start',
  })

  if (manifestPath) {
    try {
      // read manifest.json file
      // @ts-expect-error TS(2345) FIXME: Argument of type 'Buffer' is not assignable to par... Remove this comment to see the full error message
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

  return await zipFunctions(directories, tmpDir, {
    basePath: rootDir,
    configFileDirectories: [command.getPathInProject(INTERNAL_FUNCTIONS_FOLDER)],
    config: functionsConfig,
  })
}

const hashFns = async (
  command: BaseCommand,
  directories: string[],
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
  }: {
    /** @default 'function' */
    assetType?: string
    concurrentHash?: number
    functionsConfig: $TSFixMe
    /** @default 'sha256' */
    hashAlgorithm?: string
    manifestPath: $TSFixMe
    rootDir: $TSFixMe
    skipFunctionsCache: $TSFixMe
    statusCb: $TSFixMe
    tmpDir: $TSFixMe
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
    command,
    directories,
    functionsConfig,
    manifestPath,
    rootDir,
    skipFunctionsCache,
    statusCb,
    tmpDir,
  })
  const fileObjs = functionZips.map(
    // @ts-expect-error TS(7031) FIXME: Binding element 'buildData' implicitly has an 'any... Remove this comment to see the full error message
    ({ buildData, displayName, generator, invocationMode, path: functionPath, priority, runtime, runtimeVersion }) => ({
      filepath: functionPath,
      root: tmpDir,
      relname: path.relative(tmpDir, functionPath),
      basename: path.basename(functionPath),
      extname: path.extname(functionPath),
      type: 'file',
      assetType: 'function',
      normalizedPath: path.basename(functionPath, path.extname(functionPath)),
      runtime: runtimeVersion ?? runtime,
      displayName,
      generator,
      invocationMode,
      buildData,
      priority,
    }),
  )
  const fnConfig = functionZips
    // @ts-expect-error TS(7006) FIXME: Parameter 'func' implicitly has an 'any' type.
    .filter((func) => Boolean(func.displayName || func.generator || func.routes || func.buildData))
    .reduce(
      // @ts-expect-error TS(7006) FIXME: Parameter 'funcs' implicitly has an 'any' type.
      (funcs, curr) => ({
        ...funcs,
        [curr.name]: {
          display_name: curr.displayName,
          generator: curr.generator,
          routes: curr.routes,
          build_data: curr.buildData,
          priority: curr.priority,
        },
      }),
      {},
    )
  const functionSchedules = functionZips
    // @ts-expect-error TS(7031) FIXME: Binding element 'name' implicitly has an 'any' typ... Remove this comment to see the full error message
    .map(({ name, schedule }) => schedule && { name, cron: schedule })
    .filter(Boolean)
  const functionsWithNativeModules = functionZips.filter(
    // @ts-expect-error TS(7031) FIXME: Binding element 'nativeNodeModules' implicitly has... Remove this comment to see the full error message
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
