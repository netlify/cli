const flushWriteStream = require('flush-write-stream')
const hasha = require('hasha')
const transform = require('parallel-transform')
const { objCtor: objFilterCtor } = require('through2-filter')
const { obj: map } = require('through2-map')

const { normalizePath } = require('./util')

// a parallel transform stream segment ctor that hashes fileObj's created by folder-walker
// TODO: use promises instead of callbacks
/* eslint-disable promise/prefer-await-to-callbacks */
const hasherCtor = ({ concurrentHash, hashAlgorithm }) => {
  const hashaOpts = { algorithm: hashAlgorithm }
  if (!concurrentHash) throw new Error('Missing required opts')
  return transform(concurrentHash, { objectMode: true }, async (fileObj, cb) => {
    try {
      const hash = await hasha.fromFile(fileObj.filepath, hashaOpts)
      // insert hash and asset type to file obj
      return cb(null, { ...fileObj, hash })
    } catch (error) {
      return cb(error)
    }
  })
}

// Inject normalized file names into normalizedPath and assetType
const fileNormalizerCtor = ({ assetType }) =>
  map((fileObj) => ({ ...fileObj, assetType, normalizedPath: normalizePath(fileObj.relname) }))

// A writable stream segment ctor that normalizes file paths, and writes shaMap's
const manifestCollectorCtor = (filesObj, shaMap, { statusCb, assetType }) => {
  if (!statusCb || !assetType) throw new Error('Missing required options')
  return flushWriteStream.obj((fileObj, _, cb) => {
    filesObj[fileObj.normalizedPath] = fileObj.hash

    // We map a hash to multiple fileObj's because the same file
    // might live in two different locations

    if (Array.isArray(shaMap[fileObj.hash])) {
      shaMap[fileObj.hash].push(fileObj)
    } else {
      shaMap[fileObj.hash] = [fileObj]
    }
    statusCb({
      type: 'hashing',
      msg: `Hashing ${fileObj.relname}`,
      phase: 'progress',
    })
    cb(null)
  })
}
/* eslint-enable promise/prefer-await-to-callbacks */

// transform stream ctor that filters folder-walker results for only files
const fileFilterCtor = objFilterCtor((fileObj) => fileObj.type === 'file')

module.exports = {
  hasherCtor,
  fileNormalizerCtor,
  manifestCollectorCtor,
  fileFilterCtor,
}
