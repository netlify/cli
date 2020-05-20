/* Syncs blog content from repo to /site/blog */
const path = require('path')
const sane = require('sane')
const fs = require('fs-extra')
const config = require('./config')
const watcher = sane(config.docs.srcPath, { glob: ['**/*.md'] })

/* Watch Files */
watcher.on('ready', function() {
  console.log(`Watching ${config.docs.srcPath} files for changes`)
})

watcher.on('change', function(filepath, root, stat) {
  console.log('file changed', filepath)
  syncFile(filepath).then(() => {
    // console.log('done')
  })
})

watcher.on('add', function(filepath, root, stat) {
  console.log('file added')
  syncFile(filepath).then(() => {
    // console.log('done')
  })
})

watcher.on('delete', function(filepath, root) {
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
  return fs.copy(src, destination).then(() => {
    console.log(`${filePath} synced to ${destination}`)
  })
}

function deleteFile(filePath) {
  const { destination } = getFullPath(filePath)
  return fs.remove(destination).then(() => {
    console.log(`${filePath} removed from ${destination}`)
  })
}
