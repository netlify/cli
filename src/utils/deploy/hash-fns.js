const path = require('path')
const { promisify } = require('util')

const zipIt = require('@netlify/zip-it-and-ship-it')
const fromArray = require('from2-array')
const pump = promisify(require('pump'))

const { hasherCtor, manifestCollectorCtor } = require('./hasher-segments')

const hashFns = async (
  dir,
  { tmpDir, concurrentHash, functionsConfig, hashAlgorithm = 'sha256', assetType = 'function', statusCb },
) => {
  // early out if the functions dir is omitted
  if (!dir) return { functions: {}, shaMap: {} }
  if (!tmpDir) throw new Error('Missing tmpDir directory for zipping files')

  const functionZips = await zipIt.zipFunctions(dir, tmpDir, { config: functionsConfig })
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

  const functionStream = fromArray.obj(fileObjs)

  const hasher = hasherCtor({ concurrentHash, hashAlgorithm })

  // Written to by manifestCollector
  // normalizedPath: hash (wanted by deploy API)
  const functions = {}
  // hash: [fileObj, fileObj, fileObj]
  const fnShaMap = {}
  const manifestCollector = manifestCollectorCtor(functions, fnShaMap, { statusCb, assetType })

  await pump(functionStream, hasher, manifestCollector)

  return { functions, fnShaMap }
}

module.exports = { hashFns }
