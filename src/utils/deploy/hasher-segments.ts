import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import transform from 'parallel-transform'
import { obj as map } from 'through2-map'

import { normalizePath } from './util.js'

const hashFile = async (filePath: string, algorithm: string) => {
  const hasher = createHash(algorithm)
  await pipeline([createReadStream(filePath), hasher])

  return hasher.digest('hex')
}

// a parallel transform stream segment ctor that hashes fileObj's created by folder-walker
// TODO: use promises instead of callbacks
// @ts-expect-error TS(7031) FIXME: Binding element 'concurrentHash' implicitly has an... Remove this comment to see the full error message
export const hasherCtor = ({ concurrentHash, hashAlgorithm }) => {
  if (!concurrentHash) throw new Error('Missing required opts')
  return transform(concurrentHash, { objectMode: true }, async (fileObj, cb) => {
    try {
      const hash = await hashFile(fileObj.filepath, hashAlgorithm)
      // insert hash and asset type to file obj
      cb(null, { ...fileObj, hash })
      return
    } catch (error) {
      cb(error as Error)
      return
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
export const manifestCollectorCtor = (
  filesObj: Record<string, unknown>,
  shaMap: Record<string, unknown[]>,
  { assetType, statusCb }: { assetType: string; statusCb: Function },
) => {
  if (!statusCb || !assetType) throw new Error('Missing required options')

  return new Writable({
    objectMode: true,
    write(fileObj, encoding, callback) {
      filesObj[fileObj.normalizedPath] = fileObj.hash

      // Maintain hash to fileObj mapping
      if (Array.isArray(shaMap[fileObj.hash])) {
        shaMap[fileObj.hash].push(fileObj)
      } else {
        shaMap[fileObj.hash] = [fileObj]
      }

      // Update status callback
      statusCb({
        type: 'hashing',
        msg: `Hashing ${fileObj.relname}`,
        phase: 'progress',
      })

      callback()
    },
  })
}
/* eslint-enable promise/prefer-await-to-callbacks */

export const fileFilterCtor = () =>
  new Transform({
    objectMode: true,
    transform(fileObj, _, callback) {
      if (fileObj.type === 'file') {
        this.push(fileObj)
      }
      // eslint-disable-next-line promise/prefer-await-to-callbacks
      callback()
    },
  })
