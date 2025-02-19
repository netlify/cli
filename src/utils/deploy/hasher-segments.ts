import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

import flushWriteStream from 'flush-write-stream'
import transform from 'parallel-transform'
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'thro... Remove this comment to see the full error message
import { objCtor as objFilterCtor } from 'through2-filter'
import { obj as map } from 'through2-map'

import { normalizePath } from './util.js'

const hashFile = async (filePath: string, algorithm: string) => {
  const hasher = createHash(algorithm)
  await pipeline([createReadStream(filePath), hasher])

  return hasher.digest('hex')
}

// a parallel transform stream segment ctor that hashes fileObj's created by folder-walker
// TODO: use promises instead of callbacks
/* eslint-disable promise/prefer-await-to-callbacks */
// @ts-expect-error TS(7031) FIXME: Binding element 'concurrentHash' implicitly has an... Remove this comment to see the full error message
export const hasherCtor = ({ concurrentHash, hashAlgorithm }) => {
  if (!concurrentHash) throw new Error('Missing required opts')
  return transform(concurrentHash, { objectMode: true }, async (fileObj, cb) => {
    try {
      const hash = await hashFile(fileObj.filepath, hashAlgorithm)
      // insert hash and asset type to file obj
      return cb(null, { ...fileObj, hash })
    } catch (error) {
      return cb(error as Error)
    }
  })
}

// Inject normalized file names into normalizedPath and assetType
// @ts-expect-error TS(7031) FIXME: Binding element 'assetType' implicitly has an 'any... Remove this comment to see the full error message
export const fileNormalizerCtor = ({ assetType, normalizer: normalizeFunction }) =>
  map((fileObj) => {
    const normalizedFile = { ...fileObj, assetType, normalizedPath: normalizePath(fileObj.relname) }

    if (normalizeFunction !== undefined) {
      return normalizeFunction(normalizedFile)
    }

    return normalizedFile
  })

// A writable stream segment ctor that normalizes file paths, and writes shaMap's
// @ts-expect-error TS(7006) FIXME: Parameter 'filesObj' implicitly has an 'any' type.
export const manifestCollectorCtor = (filesObj, shaMap, { assetType, statusCb }) => {
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
    cb()
  })
}
/* eslint-enable promise/prefer-await-to-callbacks */

// transform stream ctor that filters folder-walker results for only files
// @ts-expect-error TS(7006) FIXME: Parameter 'fileObj' implicitly has an 'any' type.
export const fileFilterCtor = objFilterCtor((fileObj) => fileObj.type === 'file')
