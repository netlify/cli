import { pipeline } from 'stream/promises'

import walker from 'folder-walker'

import { fileFilterCtor, fileNormalizerCtor, hasherCtor, manifestCollectorCtor } from './hasher-segments.js'
import { $TSFixMe } from '../../commands/types.js'

const hashFiles = async ({
  assetType = 'file',
  concurrentHash,
  directories,
  filter,
  hashAlgorithm = 'sha1',
  normalizer,
  statusCb,
}: {
  assetType?: string | undefined
  concurrentHash: $TSFixMe
  directories: $TSFixMe
  filter: $TSFixMe
  hashAlgorithm?: string | undefined
  normalizer?: $TSFixMe
  statusCb: $TSFixMe
}): Promise<{ files: Record<string, string>; filesShaMap: Record<string, $TSFixMe[]> }> => {
  if (!filter) throw new Error('Missing filter function option')

  const fileStream = walker(directories, { filter })
  const fileFilter = fileFilterCtor()
  const hasher = hasherCtor({ concurrentHash, hashAlgorithm })
  const fileNormalizer = fileNormalizerCtor({ assetType, normalizer })

  // Written to by manifestCollector
  // normalizedPath: hash (wanted by deploy API)
  const files = {}
  // hash: [fileObj, fileObj, fileObj]
  const filesShaMap = {}
  const manifestCollector = manifestCollectorCtor(files, filesShaMap, { statusCb })

  await pipeline([fileStream, fileFilter, hasher, fileNormalizer, manifestCollector])

  return { files, filesShaMap }
}

export default hashFiles
