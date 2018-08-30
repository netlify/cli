const promisifyAll = require('util.promisify-all')
const promisify = require('util.promisify')
const pump = promisify(require('pump'))
const fs = promisifyAll(require('fs'))
const fromArray = require('from2-array')
const tempy = require('tempy')

const { hasherCtor, manifestCollectorCtor, fnStatCtor, fnFilterCtor } = require('./hasher-segments')

module.exports = hashFns
async function hashFns(dir, opts) {
  opts = Object.assign(
    {
      concurrentHash: 100,
      assetType: 'function',
      hashAlgorithm: 'sha256',
      tmpDir: tempy.directory(),
      statusCb: () => {}
    },
    opts
  )
  // early out if the functions dir is omitted
  if (!dir) return { functions: {}, shaMap: {} }
  if (!opts.filter) throw new Error('Missing required filter function')

  const fileList = await fs.readdir(dir).then(files => files.filter(opts.filter))
  const fileStream = fromArray.obj(fileList)

  const fnStat = fnStatCtor({ root: dir, concurrentStat: opts.concurrentHash, tmpDir: opts.tmpDir })
  const fnFilter = fnFilterCtor()
  const hasher = hasherCtor(opts)

  // Written to by manifestCollector
  const functions = {} // normalizedPath: hash (wanted by deploy API)
  const fnShaMap = {} //hash: [fileObj, fileObj, fileObj]
  const manifestCollector = manifestCollectorCtor(functions, fnShaMap, opts)

  // TODO: Zip up functions, hash then send.
  // This is totally wrong wright now.
  // See https://github.com/netlify/open-api/blob/master/go/porcelain/deploy.go#L544

  await pump(fileStream, fnStat, fnFilter, hasher, manifestCollector)

  return { functions, fnShaMap }
}
