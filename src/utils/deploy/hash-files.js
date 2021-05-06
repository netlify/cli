const { promisify } = require('util')

const walker = require('folder-walker')
const pump = promisify(require('pump'))

const { hasherCtor, manifestCollectorCtor, fileFilterCtor, fileNormalizerCtor } = require('./hasher-segments')

const hashFiles = async (
  dir,
  configPath,
  { concurrentHash, hashAlgorithm = 'sha1', assetType = 'file', statusCb, filter },
) => {
  if (!filter) throw new Error('Missing filter function option')
  const fileStream = walker([configPath, dir], { filter })
  const fileFilter = fileFilterCtor()
  const hasher = hasherCtor({ concurrentHash, hashAlgorithm })
  const fileNormalizer = fileNormalizerCtor({ assetType })

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
