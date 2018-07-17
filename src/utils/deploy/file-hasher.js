const promisify = require('util.promisify')
const walker = require('folder-walker')
const pump = promisify(require('pump'))
const objFilter = require('through2-filter').obj
const transform = require('parallel-transform')
const hasha = require('hasha')
const objWriter = require('flush-write-stream').obj
const path = require('path')

module.exports = fileHasher
async function fileHasher(dir, opts) {
  opts = Object.assign(
    {
      parallel: 100
    },
    opts
  )

  // Written to by manifestCollector
  const files = {} // normalizedPath: sha1 (wanted by deploy API)
  const shaMap = {} //sha1: [fileObj, fileObj, fileObj]

  const fileStream = walker(dir)

  const filter = objFilter(
    fileObj => fileObj.type === 'file' && (fileObj.relname.match(/(\/__MACOSX|\/\.)/) ? false : true)
  )

  const hasher = transform(opts.parallel, { objectMode: true }, (fileObj, cb) => {
    hasha
      .fromFile(fileObj.filepath, { algorithm: 'sha1' })
      .then(sha1 => cb(null, Object.assign({}, fileObj, { sha1 })))
      .catch(err => cb(err))
  })

  const manifestCollector = objWriter(write)
  function write(fileObj, _, cb) {
    const normalizedPath = normalizePath(fileObj.relname)

    files[normalizedPath] = fileObj.sha1
    // We map a sha1 to multiple fileObj's because the same file
    // might live in two different locations
    const normalizedFileObj = Object.assign({}, fileObj, { normalizedPath })
    if (Array.isArray(shaMap[fileObj.sha1])) {
      shaMap[fileObj.sha1].push(normalizedFileObj)
    } else {
      shaMap[fileObj.sha1] = [normalizedFileObj]
    }

    cb(null)
  }

  await pump(fileStream, filter, hasher, manifestCollector)

  return { files, shaMap }
}

module.exports.normalizePath = normalizePath
function normalizePath(relname) {
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
