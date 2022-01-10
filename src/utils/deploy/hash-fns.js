const path = require('path')
const { promisify } = require('util')

const zipIt = require('@netlify/zip-it-and-ship-it')
const fromArray = require('from2-array')
const pump = promisify(require('pump'))

const { hasherCtor, manifestCollectorCtor } = require('./hasher-segments')

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
      // eslint-disable-next-line import/no-dynamic-require, node/global-require
      const { functions, timestamp } = require(manifestPath)
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

  return await zipIt.zipFunctions(directories, tmpDir, { basePath: rootDir, config: functionsConfig })
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
  const fileObjs = functionZips.map(({ path: functionPath, runtime }) => ({
    filepath: functionPath,
    root: tmpDir,
    relname: path.relative(tmpDir, functionPath),
    basename: path.basename(functionPath),
    extname: path.extname(functionPath),
    type: 'file',
    assetType: 'function',
    normalizedPath: path.basename(functionPath, path.extname(functionPath)),
    runtime,
  }))
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

  return { functionSchedules, functions, functionsWithNativeModules, fnShaMap }
}

module.exports = { hashFns }
