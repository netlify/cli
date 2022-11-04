const flushWriteStream = require('flush-write-stream')
const hasha = require('hasha')
const transform = require('parallel-transform')
const { objCtor: objFilterCtor } = require('through2-filter')
const { obj: map } = require('through2-map')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'normalizeP... Remove this comment to see the full error message
const { normalizePath } = require('./util.cjs')

// a parallel transform stream segment ctor that hashes fileObj's created by folder-walker
// TODO: use promises instead of callbacks
/* eslint-disable promise/prefer-await-to-callbacks */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'hasherCtor... Remove this comment to see the full error message
const hasherCtor = ({
  concurrentHash,
  hashAlgorithm
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const hashaOpts = { algorithm: hashAlgorithm }
  if (!concurrentHash) throw new Error('Missing required opts')
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  return transform(concurrentHash, { objectMode: true }, async (fileObj: $TSFixMe, cb: $TSFixMe) => {
    try {
      const hash = await hasha.fromFile(fileObj.filepath, hashaOpts)
      // insert hash and asset type to file obj
      return cb(null, { ...fileObj, hash })
    } catch (error) {
      return cb(error)
    }
  });
}

// Inject normalized file names into normalizedPath and assetType
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fileNormal... Remove this comment to see the full error message
const fileNormalizerCtor = ({
  assetType,
  normalizer: normalizeFunction
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) =>
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  map((fileObj: $TSFixMe) => {
    const normalizedFile = { ...fileObj, assetType, normalizedPath: normalizePath(fileObj.relname) }

    if (normalizeFunction !== undefined) {
      return normalizeFunction(normalizedFile)
    }

    return normalizedFile
  })

// A writable stream segment ctor that normalizes file paths, and writes shaMap's
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'manifestCo... Remove this comment to see the full error message
const manifestCollectorCtor = (filesObj: $TSFixMe, shaMap: $TSFixMe, {
  assetType,
  statusCb
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  if (!statusCb || !assetType) throw new Error('Missing required options')
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  return flushWriteStream.obj((fileObj: $TSFixMe, _: $TSFixMe, cb: $TSFixMe) => {
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
  });
}
/* eslint-enable promise/prefer-await-to-callbacks */

// transform stream ctor that filters folder-walker results for only files
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fileFilter... Remove this comment to see the full error message
const fileFilterCtor = objFilterCtor((fileObj: $TSFixMe) => fileObj.type === 'file')

module.exports = {
  hasherCtor,
  fileNormalizerCtor,
  manifestCollectorCtor,
  fileFilterCtor,
}
