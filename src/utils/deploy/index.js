const promisify = require('util.promisify')
const walker = require('folder-walker')
const pump = promisify(require('pump'))
const objFilter = require('through2-filter').obj
const transform = require('parallel-transform')
const hasha = require('hasha')
const objWriter = require('flush-write-stream').obj
const path = require('path')

const noop = () => {}

function deploy(api, siteId, dir) {}

exports.fileHasher = fileHasher
function fileHasher(dir, opts) {
  opts = {
    onProgress: noop,
    parallel: 100,
    ...opts
  }
  const manifest = {}
  const shaMap = {}

  const progress = {
    total: 0,
    current: 0
  }

  let progressDue = true
  const throttle = setInterval(() => {
    progressDue = true
  }, 500)

  const fileStream = walker(dir)

  const filter = objFilter(
    fileObj => fileObj.type === 'file' && (fileObj.relname.match(/(\/__MACOSX|\/\.)/) ? false : true)
  )

  const hasher = transform(opts.parallel, { objectMode: true }, (fileObj, cb) => {
    progress.total++
    hasha
      .fromFile(fileObj.filepath, { algorithm: 'sha1' })
      .then(sha1 => cb(null, { ...fileObj, sha1 }))
      .catch(err => cb(err))
  })

  const manifestCollector = objWriter(
    (fileObj, _, cb) => {
      const filePath = manifestPath(fileObj.relname)

      manifest[filePath] = fileObj.sha1
      shaMap[fileObj.sha1] = fileObj

      progress.current++
      if (progressDue) {
        progressDue = false
        opts.onProgress({ ...progress })
      }

      cb(null)
    },
    cb => {
      opts.onProgress({ ...progress })
      clearInterval(throttle)
      cb(null)
    }
  )

  return pump(fileStream, filter, hasher, manifestCollector).then(() => ({ manifest, shaMap }))
}

function manifestPath(relname) {
  return (
    '/' +
    relname
      .split(path.sep)
      .map(segment => {
        return encodeURIComponent(segment)
      })
      .join('/')
  )
}

function uploadFiles(manifest, dir) {}
