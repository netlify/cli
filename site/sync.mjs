import { promises as fs } from 'fs'
import { join, basename, dirname } from 'path'

import { docs } from './config.js'
import { copyDirRecursiveAsync } from './fs.js'

const readDir = async function (dir, allFiles = []) {
  const filenames = await fs.readdir(dir)
  const files = filenames.map((file) => join(dir, file))
  allFiles.push(...files)
  await Promise.all(
    files.map(async (file) => {
      const fileStat = await fs.stat(file)
      return fileStat.isDirectory() && readDir(file, allFiles)
    }),
  )
  return allFiles
}

const syncLocalContent = async function () {
  const src = join(docs.srcPath)
  const destination = join(docs.outputPath)

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
  await fs.writeFile(filePath, newContent)
  return filePath
}

syncLocalContent()
