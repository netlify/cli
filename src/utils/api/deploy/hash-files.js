const promisify = require('util.promisify')
const walker = require('folder-walker')
const pump = promisify(require('pump'))
const { hasherCtor, manifestCollectorCtor, fileFilterCtor, fileNormalizerCtor } = require('./hasher-segments')

module.exports = hashFiles
async function hashFiles(dir, opts) {
  opts = Object.assign(
    {
      concurrentHash: 100,
      assetType: 'file'
    },
    opts
  )

  const fileStream = walker(dir)
  const filter = fileFilterCtor()
  const hasher = hasherCtor(opts)
  const fileNormalizer = fileNormalizerCtor(opts)

  // Written to by manifestCollector
  const files = {} // normalizedPath: hash (wanted by deploy API)
  const filesShaMap = {} //hash: [fileObj, fileObj, fileObj]
  const manifestCollector = manifestCollectorCtor(files, filesShaMap)

  await pump(fileStream, filter, hasher, fileNormalizer, manifestCollector)

  return { files, filesShaMap }
}
