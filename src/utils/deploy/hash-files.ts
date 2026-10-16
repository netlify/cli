import { pipeline } from 'stream/promises'

import walker from 'folder-walker'

import type { File } from './file.js'
import { fileFilterCtor, fileNormalizerCtor, hasherCtor, manifestCollectorCtor } from './hasher-segments.js'
import type { StatusCallback } from './status-cb.js'

const hashFiles = async ({
  assetType = 'file',
  concurrentHash,
  directories,
  filter,
  hashAlgorithm = 'sha1',
  normalizer,
  statusCb,
}: {
  assetType?: 'file' | undefined
  concurrentHash: number
  directories: string[]
  filter: ((filename: string) => boolean) | undefined
  hashAlgorithm?: string | undefined
  normalizer?: (file: File) => File
  statusCb: StatusCallback
}): Promise<{ files: Record<string, string>; filesShaMap: Record<string, File[]> }> => {
  if (!filter) throw new Error('Missing filter function option')

  const fileStream = walker(directories, { filter })
  const fileFilter = fileFilterCtor()
  const hasher = hasherCtor({ concurrentHash, hashAlgorithm })
  const fileNormalizer = fileNormalizerCtor({ assetType, normalizer })

  // Written to by manifestCollector
  // normalizedPath: hash (wanted by deploy API)
  const files: Record<string, string> = {}
  // hash: [fileObj, fileObj, fileObj]
  const filesShaMap: Record<string, File[]> = {}
  const manifestCollector = manifestCollectorCtor(files, filesShaMap, { statusCb })

  await pipeline([fileStream, fileFilter, hasher, fileNormalizer, manifestCollector])

  return { files, filesShaMap }
}

export default hashFiles
