const path = require('path')
const { promisify } = require('util')

const zipIt = require('@netlify/zip-it-and-ship-it')
const fromArray = require('from2-array')
const pump = promisify(require('pump'))

const { hasherCtor, manifestCollectorCtor } = require('./hasher-segments')

// Maximum age of functions manifest (2 minutes).
const MANIFEST_FILE_TTL = 12e4

const getFunctionZips = async ({ directories, functionsConfig, manifestPath, rootDir, statusCb, tmpDir }) => {
  statusCb({
    type: 'functions-manifest',
    msg: 'Looking for a functions manifest file...',
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
        msg: 'Using bundled functions from manifest file (use --bundle to override)',
        phase: 'stop',
      })

      return functions
    } catch (error) {
      statusCb({
        type: 'functions-manifest',
        msg: 'Ignored invalid or expired functions manifest file',
        phase: 'stop',
      })
    }
  } else {
    statusCb({
      type: 'functions-manifest',
      msg: 'No functions manifest file was found',
      phase: 'stop',
    })
  }

  return await zipIt.zipFunctions(directories, tmpDir, { basePath: rootDir, config: functionsConfig })
}

const hashFns = async (
  directories,
  {
    tmpDir,
    concurrentHash,
    functionsConfig,
    hashAlgorithm = 'sha256',
    assetType = 'function',
    statusCb,
    rootDir,
    manifestPath,
  },
) => {
  // Early out if no functions directories are configured.
  if (directories.length === 0) {
    return { functions: {}, functionsWithNativeModules: [], shaMap: {} }
  }

  if (!tmpDir) {
    throw new Error('Missing tmpDir directory for zipping files')
  }

  const functionZips = await getFunctionZips({ directories, functionsConfig, manifestPath, rootDir, statusCb, tmpDir })
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

  return { functions, functionsWithNativeModules, fnShaMap }
}

module.exports = { hashFns }
