const fs = require('fs').promises
const path = require('path')

const config = require('./config')
const { copyDirRecursiveAsync } = require('./fs')

const readDir = async function (dir, allFiles = []) {
  const files = (await fs.readdir(dir)).map((file) => path.join(dir, file))
  allFiles.push(...files)
  await Promise.all(files.map(async (file) => (await fs.stat(file)).isDirectory() && readDir(file, allFiles)))
  return allFiles
}

const syncLocalContent = async function () {
  const src = path.join(config.docs.srcPath)
  const destination = path.join(config.docs.outputPath)

  await copyDirRecursiveAsync(src, destination)
  console.log(`Docs synced to ${destination}`)

  const files = await readDir(destination)
  const mdFiles = files.filter((file) => file.endsWith('.md')).map((file) => removeMarkDownLinks(file))

  await Promise.all(mdFiles)
  console.log('Synced!')
}

const removeMarkDownLinks = async function (filePath) {
  const content = await fs.readFile(filePath, 'utf-8')
  const newContent = content.replace(/(\w+)\.md/gm, '$1').replace(/\/docs\/commands\//gm, '/commands/')
  // Rename README.md to index.md
  if (path.basename(filePath) === 'README.md') {
    const newPath = path.join(path.dirname(filePath), 'index.md')
    // Delete README.md from docs site
    await fs.unlink(filePath)
    // Write index.md
    await fs.writeFile(newPath, newContent)
    return newPath
  }
  await fs.writeFile(filePath, newContent)
  return filePath
}

syncLocalContent()
