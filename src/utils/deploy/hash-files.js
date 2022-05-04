const { promisify } = require('util')

const walker = require('folder-walker')
const pump = promisify(require('pump'))

const { fileFilterCtor, fileNormalizerCtor, hasherCtor, manifestCollectorCtor } = require('./hasher-segments')

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

module.exports = { hashFiles }
