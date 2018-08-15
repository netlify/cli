const promisifyAll = require('util.promisify-all')
const promisify = require('util.promisify')
const pump = promisify(require('pump'))
const fs = promisifyAll(require('fs'))
const fromArray = require('from2-array')

const { hasherCtor, manifestCollectorCtor, fnStatCtor, fnNormalizerCtor, fnFilterCtor } = require('./hasher-segments')

module.exports = hashFns
async function hashFns(dir, opts) {
  opts = Object.assign(
    {
      concurrentHash: 100,
      assetType: 'function',
      hashAlgorithm: 'sha256'
    },
    opts
  )
  // early out if the functions dir is omitted
  if (!dir) return { functions: {}, shaMap: {} }

  const fileList = await fs.readdir(dir)
  const fileStream = fromArray.obj(fileList)

  const fnStat = fnStatCtor({ root: dir, concurrentStat: opts.concurrentHash })
  const fnFilter = fnFilterCtor()
  const hasher = hasherCtor(opts)
  const fnNormalizer = fnNormalizerCtor(opts)

  // Written to by manifestCollector
  const functions = {} // normalizedPath: hash (wanted by deploy API)
  const fnShaMap = {} //hash: [fileObj, fileObj, fileObj]
  const manifestCollector = manifestCollectorCtor(functions, fnShaMap)

  await pump(fileStream, fnStat, fnFilter, hasher, fnNormalizer, manifestCollector)

  return { functions, fnShaMap }
}
