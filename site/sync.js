const path = require('path')
const fs = require('fs-extra')
const config = require('./config')
const { promisify } = require('util')
const readdirP = promisify(fs.readdir)
const statP = promisify(fs.stat)
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const deleteFile = promisify(fs.unlink)

async function readDir(dir, allFiles = []) {
  const files = (await readdirP(dir)).map(f => path.join(dir, f))
  allFiles.push(...files)
  await Promise.all(files.map(async f => (await statP(f)).isDirectory() && readDir(f, allFiles)))
  return allFiles
}

async function syncLocalContent() {
  const src = path.join(config.docs.srcPath)
  const destination = path.join(config.docs.outputPath)

  await fs.copy(src, destination)
  console.log(`Docs synced to ${destination}`)

  const files = await readDir(destination)
  const mdFiles = files
    .filter(file => {
      return file.endsWith('.md')
    })
    .map(path => {
      return removeMarkDownLinks(path)
    })

  await Promise.all(mdFiles)
}

async function removeMarkDownLinks(filePath) {
  const content = await readFile(filePath, 'utf-8')
  const newContent = content.replace(/(\w+)\.md/gm, '$1').replace(/\/docs\/commands\//gm, '/commands/')
  // Rename README.md to index.md
  if (path.basename(filePath) === 'README.md') {
    const newPath = path.join(path.dirname(filePath), 'index.md')
    // Delete README.md from docs site
    await deleteFile(filePath)
    // Write index.md
    await writeFile(newPath, newContent)
    return newPath
  }
  await writeFile(filePath, newContent)
  return filePath
}

syncLocalContent().then(() => {
  console.log('Synced!')
})
