const objFilterCtor = require('through2-filter').objCtor
const objWriter = require('flush-write-stream').obj
const { normalizePath, isExe } = require('./util')
const transform = require('parallel-transform')
const hasha = require('hasha')
const path = require('path')
const fs = require('fs')

// a parallel transform stream segment ctor that hashes fileObj's created by folder-walker
exports.hasherCtor = ({ concurrentHash, assetType }) => {
  if (!concurrentHash || !assetType) throw new Error('Missing required opts')
  return transform(concurrentHash, { objectMode: true, ordered: false }, (fileObj, cb) => {
    hasha
      .fromFile(fileObj.filepath, { algorithm: 'sha1' })
      // insert sha1 and asset type to file obj
      .then(sha1 => cb(null, Object.assign({}, fileObj, { sha1, assetType })))
      .catch(err => cb(err))
  })
}

// A writable stream segment ctor that normalizes file paths, and writes shaMap's
exports.manifestCollectorCtor = (filesObj, shaMap) => {
  return objWriter((fileObj, _, cb) => {
    const normalizedPath = normalizePath(fileObj.relname)

    filesObj[normalizedPath] = fileObj.sha1

    // We map a sha1 to multiple fileObj's because the same file
    // might live in two different locations

    const normalizedFileObj = Object.assign({}, fileObj, { normalizedPath })
    if (Array.isArray(shaMap[fileObj.sha1])) {
      shaMap[fileObj.sha1].push(normalizedFileObj)
    } else {
      shaMap[fileObj.sha1] = [normalizedFileObj]
    }

    cb(null)
  })
}

// transform stream ctor that filters folder-walker results for only files
exports.fileFilterCtor = objFilterCtor(
  fileObj => fileObj.type === 'file' && (fileObj.relname.match(/(\/__MACOSX|\/\.)/) ? false : true)
)

// parallel stream ctor similar to folder-walker but specialized for netlify functions
// Stream in names of files that may be functions, and this will stat the file and return a fileObj
exports.fnStatFilterCtor = ({ root, concurrentStat }) => {
  if (!concurrentStat || !root) throw new Error('Missing required opts')
  return transform(concurrentStat, { objectMode: true, ordered: false }, (name, cb) => {
    const filepath = path.join(root, name)

    fs.stat(filepath, (err, stat) => {
      if (err) return cb(err)

      const item = {
        root,
        filepath,
        stat,
        relname: path.relative(root, name),
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

      // skip anything else
      return cb()
    })
  })
}
