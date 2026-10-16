import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import transform from 'parallel-transform'

import type { File, HashedFile, OriginalFile } from './file.js'
import { normalizePath } from './util.js'
import type { StatusCallback } from './status-cb.js'

const hashFile = async (filePath: string, algorithm: string) => {
  const hasher = createHash(algorithm)
  await pipeline([createReadStream(filePath), hasher])

  return hasher.digest('hex')
}

// a parallel transform stream segment ctor that hashes fileObj's created by folder-walker
// TODO: use promises instead of callbacks
export const hasherCtor = ({ concurrentHash, hashAlgorithm }: { concurrentHash?: number; hashAlgorithm: string }) => {
  if (!concurrentHash) throw new Error('Missing required opts')
  return transform(concurrentHash, { objectMode: true }, async (fileObj: { filepath: string }, cb) => {
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
export const fileNormalizerCtor = ({ normalizer: normalizeFunction }: { normalizer?: (file: File) => File }) => {
  return new Transform({
    objectMode: true,
    transform(fileObj: HashedFile, _, callback) {
      const normalizedFile: File = { ...fileObj, assetType: 'file', normalizedPath: normalizePath(fileObj.relname) }

      const result = normalizeFunction !== undefined ? normalizeFunction(normalizedFile) : normalizedFile

      this.push(result)

      callback()
    },
  })
}

// A writable stream segment ctor that normalizes file paths, and writes shaMap's
export const manifestCollectorCtor = <T extends { hash: string; normalizedPath: string; relname: string }>(
  filesObj: Record<string, string>,
  shaMap: Record<string, T[]>,
  { statusCb }: { statusCb: StatusCallback },
) => {
  return new Writable({
    objectMode: true,
    write(fileObj: T, _encoding, callback) {
      filesObj[fileObj.normalizedPath] = fileObj.hash

      // Maintain hash to fileObj mapping
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

      callback()
    },
  })
}

export const fileFilterCtor = () =>
  new Transform({
    objectMode: true,
    transform(fileObj: OriginalFile, _, callback) {
      if (fileObj.type === 'file') {
        this.push(fileObj)
      }
      callback()
    },
  })
