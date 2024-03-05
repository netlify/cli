/* Syncs blog content from repo to /site/blog */
import { copyFile, rm } from 'fs/promises'
import { join } from 'path'

import sane from 'sane'

import { docs } from './config.js'
import { ensureFilePathAsync } from './fs.js'

const watcher = sane(docs.srcPath, { glob: ['**/*.md'] })

/* Watch Files */
watcher.on('ready', function onReady() {
  console.log(`Watching ${docs.srcPath} files for changes`)
})

watcher.on('change', async function onChange(filepath) {
  console.log('file changed', filepath)
  await syncFile(filepath)
})

watcher.on('add', async function onAdd(filepath) {
  console.log('file added')
  await syncFile(filepath)
})

watcher.on('delete', async function onDelete(filepath) {
  console.log('file deleted', filepath)
  await deleteFile(filepath)
  console.log('File deletion complete')
})

/* utils */
const getFullPath = function (filePath) {
  return {
    src: join(docs.srcPath, filePath),
    destination: join(docs.outputPath, filePath),
  }
}

const syncFile = async function (filePath) {
  const { destination, src } = getFullPath(filePath)
  await ensureFilePathAsync(destination)
  await copyFile(src, destination)
  console.log(`${filePath} synced to ${destination}`)
}

const deleteFile = async function (filePath) {
  const { destination } = getFullPath(filePath)
  await rm(destination, { force: true, recursive: true })
  console.log(`${filePath} removed from ${destination}`)
}
