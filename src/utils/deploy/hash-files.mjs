import { promisify } from 'util'

import walker from 'folder-walker'
import pumpModule from 'pump'

import { fileFilterCtor, fileNormalizerCtor, hasherCtor, manifestCollectorCtor } from './hasher-segments.mjs'

const pump = promisify(pumpModule)

const hashFiles = async ({
  assetType = 'file',
  concurrentHash,
  directories,
  filter,
  hashAlgorithm = 'sha1',
  normalizer,
  statusCb,
}) => {
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
  const manifestCollector = manifestCollectorCtor(files, filesShaMap, { statusCb, assetType })

  await pump(fileStream, fileFilter, hasher, fileNormalizer, manifestCollector)

  return { files, filesShaMap }
}

export default hashFiles
