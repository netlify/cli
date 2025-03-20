import { pipeline } from 'stream/promises'

import walker from 'folder-walker'

import { fileFilterCtor, fileNormalizerCtor, hasherCtor, manifestCollectorCtor } from './hasher-segments.js'

const hashFiles = async ({
  assetType = 'file',
  // @ts-expect-error TS(7031) FIXME: Binding element 'concurrentHash' implicitly has an... Remove this comment to see the full error message
  concurrentHash,
  // @ts-expect-error TS(7031) FIXME: Binding element 'directories' implicitly has an 'a... Remove this comment to see the full error message
  directories,
  // @ts-expect-error TS(7031) FIXME: Binding element 'filter' implicitly has an 'any' t... Remove this comment to see the full error message
  filter,
  hashAlgorithm = 'sha1',
  // @ts-expect-error TS(7031) FIXME: Binding element 'normalizer' implicitly has an 'an... Remove this comment to see the full error message
  normalizer,
  // @ts-expect-error TS(7031) FIXME: Binding element 'statusCb' implicitly has an 'any'... Remove this comment to see the full error message
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

  await pipeline([fileStream, fileFilter, hasher, fileNormalizer, manifestCollector])

  return { files, filesShaMap }
}

export default hashFiles
