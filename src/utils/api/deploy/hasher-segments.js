const objFilterCtor = require('through2-filter').objCtor
const objWriter = require('flush-write-stream').obj
const { isExe, normalizePath } = require('./util')
const transform = require('parallel-transform')
const hasha = require('hasha')
const path = require('path')
const fs = require('fs')
const map = require('through2-map').obj
const pump = require('pump')
const archiver = require('archiver')

// a parallel transform stream segment ctor that hashes fileObj's created by folder-walker
exports.hasherCtor = ({ concurrentHash, hashAlgorithm = 'sha1' }) => {
  if (!concurrentHash) throw new Error('Missing required opts')
  return transform(concurrentHash, { objectMode: true }, (fileObj, cb) => {
    hasha
      .fromFile(fileObj.filepath, { algorithm: hashAlgorithm })
      // insert hash and asset type to file obj
      .then(hash => cb(null, Object.assign({}, fileObj, { hash })))
      .catch(err => cb(err))
  })
}

// Inject normalized file names into normalizedPath and assetType
exports.fileNormalizerCtor = fileNormalizerCtor
function fileNormalizerCtor({ assetType = 'file' }) {
  return map(fileObj => {
    return Object.assign({}, fileObj, { assetType, normalizedPath: normalizePath(fileObj.relname) })
  })
}

// A writable stream segment ctor that normalizes file paths, and writes shaMap's
exports.manifestCollectorCtor = (filesObj, shaMap, { statusCb, assetType }) => {
  if (!statusCb || !assetType) throw new Error('Missing required options')
  return objWriter((fileObj, _, cb) => {
    filesObj[fileObj.normalizedPath] = fileObj.hash

    // We map a hash to multiple fileObj's because the same file
    // might live in two different locations

    if (Array.isArray(shaMap[fileObj.hash])) {
      shaMap[fileObj.hash].push(fileObj)
    } else {
      shaMap[fileObj.hash] = [fileObj]
    }
    statusCb({
      type: 'hashing',
      msg: `Hashing ${fileObj.relname}`,
      phase: 'progress'
    })
    cb(null)
  })
}

// transform stream ctor that filters folder-walker results for only files
exports.fileFilterCtor = objFilterCtor(fileObj => {
  return fileObj.type === 'file'
})

exports.fnFilterCtor = objFilterCtor(fileObj => {
  // filter additional files out of our fn pipeline
  return fileObj.type === 'file' && !!fileObj.runtime
})

// Zip a file into a temporary directory
function zipFunction(item, tmpDir, cb) {
  const zipPath = path.join(tmpDir, item.normalizedPath + '.zip')
  const output = fs.createWriteStream(zipPath)
  const archive = archiver('zip')

  archive.file(item.filepath, { name: item.basename })
  archive.finalize()

  pump(archive, output, err => {
    if (err) return cb(err)

    item.filepath = zipPath
    cb(null, item)
  })
}

// parallel stream ctor similar to folder-walker but specialized for netlify functions
// Stream in names of files that may be functions, and this will stat the file and return a fileObj
exports.fnStatCtor = ({ root, concurrentStat, tmpDir }) => {
  if (!concurrentStat || !root || !tmpDir) throw new Error('Missing required opts')
  return transform(concurrentStat, { objectMode: true }, (name, cb) => {
    const filepath = path.join(root, name)
    fs.stat(filepath, (err, stat) => {
      if (err) return cb(err)

      const item = {
        root,
        filepath,
        stat,
        relname: path.relative(root, filepath),
        basename: path.basename(name),
        extname: path.extname(name),
        type: stat.isFile() ? 'file' : stat.isDirectory() ? 'directory' : null,
        assetType: 'function',
        normalizedPath: path.basename(name, path.extname(name))
      }

      if (['.zip'].some(ext => item.extname === ext)) {
        item.runtime = 'js'
        return cb(null, item)
      }

      if (['.js'].some(ext => item.extname === ext)) {
        item.runtime = 'js'

        return zipFunction(item, tmpDir, cb)
      }

      if (isExe(item.stat)) {
        item.runtime = 'go'
        return zipFunction(item, tmpDir, cb)
      }

      return cb(null, item)
    })
  })
}
