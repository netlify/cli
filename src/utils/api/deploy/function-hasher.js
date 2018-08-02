const promisifyAll = require('util.promisify-all')
const promisify = require('util.promisify')
const transform = require('parallel-transform')
const pump = promisify(require('pump'))
const fs = promisifyAll(require('fs'))
const fromArray = require('from2-array')
const path = require('path')
const hasha = require('hasha')
const objWriter = require('flush-write-stream').obj
const { normalizePath } = require('./util')

module.exports = functionHasher
async function functionHasher(dir, opts) {
  opts = Object.assign(
    {
      parallelHash: 100
    },
    opts
  )
  if (!dir) return { functions: null, shaMap: {} }

  const fileList = await fs.readdir(dir)

  const fileStream = fromArray.obj(fileList)

  const statFilter = transform(opts.parallelHash, { objectMode: true, ordered: false }, (name, cb) => {
    const filepath = path.join(dir, name)

    fs.stat(filepath, (err, stat) => {
      if (err) return cb(err)
      const item = {
        root: dir,
        filepath,
        stat,
        relname: path.relative(dir, name),
        basename: path.basename(name),
        extname: path.extname(name),
        type: stat.isFile() ? 'file' : stat.isDirectory() ? 'directory' : null
      }

      if (item.type !== 'file') return cb() // skip folders
      if (['.zip', '.js'].some(ext => item.extname === ext)) {
        item.runtime = 'js'
        return cb(null, item)
      }
      if (isExe(item.stat)) {
        item.runtime = 'go'
        return cb(null, item)
      }
      // skip
      return cb()
    })
  })

  const hasher = transform(opts.parallelHash, { objectMode: true }, (fileObj, cb) => {
    hasha
      .fromFile(fileObj.filepath, { algorithm: 'sha1' })
      .then(sha1 => cb(null, Object.assign({}, fileObj, { sha1 })))
      .catch(err => cb(err))
  })

  // Written to by manifestCollector
  const fns = {} // normalizedPath: sha1 (wanted by deploy API)
  const shaMap = {} //sha1: [fileObj, fileObj, fileObj]
  const manifestCollector = objWriter(write)
  function write(fileObj, _, cb) {
    const normalizedPath = normalizePath(fileObj.relname)
    fns[normalizedPath] = fileObj.sha1
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

  await pump(fileStream, statFilter, hasher, manifestCollector)

  return { functions: fns, shaMap: {} }
}

const isExe = stat => {
  const { mode, gid, uid } = stat
  if (process.platform === 'win32') {
    return true
  }

  const isGroup = gid ? process.getgid && gid === process.getgid() : true
  const isUser = uid ? process.getuid && uid === process.getuid() : true

  return Boolean(mode & 0o0001 || (mode & 0o0010 && isGroup) || (mode & 0o0100 && isUser))
}
