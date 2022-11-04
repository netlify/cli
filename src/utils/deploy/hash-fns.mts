// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'path'.
const path = require('path')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'promisify'... Remove this comment to see the full error message
const { promisify } = require('util')

const fromArray = require('from2-array')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'pump'.
const pump = promisify(require('pump'))

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'hasherCtor... Remove this comment to see the full error message
const { hasherCtor, manifestCollectorCtor } = require('./hasher-segments.cjs')

// Maximum age of functions manifest (2 minutes).
const MANIFEST_FILE_TTL = 12e4

const getFunctionZips = async ({
  directories,
  functionsConfig,
  manifestPath,
  rootDir,
  skipFunctionsCache,
  statusCb,
  tmpDir
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  statusCb({
    type: 'functions-manifest',
    msg: 'Looking for a functions cache...',
    phase: 'start',
  })

  if (manifestPath) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, n/global-require
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

  const { zipFunctions } = await import('@netlify/zip-it-and-ship-it')

  return await zipFunctions(directories, tmpDir, { basePath: rootDir, config: functionsConfig })
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'hashFns'.
const hashFns = async (
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  directories: $TSFixMe,
  {
    assetType = 'function',
    concurrentHash,
    functionsConfig,
    hashAlgorithm = 'sha256',
    manifestPath,
    rootDir,
    skipFunctionsCache,
    statusCb,
    tmpDir
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe,
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
  const fileObjs = functionZips.map(({
    path: functionPath,
    runtime
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe) => ({
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
    .map(({
    name,
    schedule
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe) => schedule && { name, cron: schedule })
    .filter(Boolean)
  const functionsWithNativeModules = functionZips.filter(
    ({
      nativeNodeModules
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    }: $TSFixMe) => nativeNodeModules !== undefined && Object.keys(nativeNodeModules).length !== 0,
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
