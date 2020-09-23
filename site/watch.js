/* Syncs blog content from repo to /site/blog */
const path = require('path')
const sane = require('sane')
const _fs = require('fs')
const util = require('util')

const config = require('./config')

const watcher = sane(config.docs.srcPath, { glob: ['**/*.md'] })

const fs = {
  copyFile: util.promisify(_fs.copyFile),
  unlink: util.promisify(_fs.unlink),
}

/* Watch Files */
watcher.on('ready', function() {
  console.log(`Watching ${config.docs.srcPath} files for changes`)
})

watcher.on('change', function(filepath) {
  console.log('file changed', filepath)
  syncFile(filepath).then(() => {
    // console.log('done')
  })
})

watcher.on('add', function(filepath) {
  console.log('file added')
  syncFile(filepath).then(() => {
    // console.log('done')
  })
})

watcher.on('delete', function(filepath) {
  console.log('file deleted', filepath)
  deleteFile(filepath).then(() => {
    console.log('File deletion complete')
  })
})

/* utils */
function getFullPath(filePath) {
  return {
    src: path.join(config.docs.srcPath, filePath),
    destination: path.join(config.docs.outputPath, filePath),
  }
}

function syncFile(filePath) {
  const { src, destination } = getFullPath(filePath)
  return fs.copyFile(src, destination).then(() => {
    console.log(`${filePath} synced to ${destination}`)
  })
}

function deleteFile(filePath) {
  const { destination } = getFullPath(filePath)
  return fs.unlink(destination).then(() => {
    console.log(`${filePath} removed from ${destination}`)
  })
}
