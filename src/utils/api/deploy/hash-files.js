const promisify = require('util.promisify')
const walker = require('folder-walker')
const pump = promisify(require('pump'))
const { hasherCtor, manifestCollectorCtor, fileFilterCtor, fileNormalizerCtor } = require('./hasher-segments')

module.exports = hashFiles
async function hashFiles(dir, tomlPath, opts) {
  opts = Object.assign(
    {
      concurrentHash: 100,
      assetType: 'file',
      statusCb: () => {}
    },
    opts
  )

  if (!opts.filter) throw new Error('Missing filter function option')
  const fileStream = walker([tomlPath, dir], { filter: opts.filter })
  const filter = fileFilterCtor()
  const hasher = hasherCtor(opts)
  const fileNormalizer = fileNormalizerCtor(opts)

  // Written to by manifestCollector
  const files = {} // normalizedPath: hash (wanted by deploy API)
  const filesShaMap = {} //hash: [fileObj, fileObj, fileObj]
  const manifestCollector = manifestCollectorCtor(files, filesShaMap, opts)

  await pump(fileStream, filter, hasher, fileNormalizer, manifestCollector)

  return { files, filesShaMap }
}
