const promisify = require('util.promisify')
const walker = require('folder-walker')
const pump = promisify(require('pump'))
const { hasherCtor, manifestCollectorCtor, fileFilterCtor } = require('./hasher-segments')

module.exports = fileHasher
async function fileHasher(dir, opts) {
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

  // Written to by manifestCollector
  const files = {} // normalizedPath: sha1 (wanted by deploy API)
  const filesShaMap = {} //sha1: [fileObj, fileObj, fileObj]
  const manifestCollector = manifestCollectorCtor(files, filesShaMap)

  await pump(fileStream, filter, hasher, manifestCollector)

  return { files, filesShaMap }
}
