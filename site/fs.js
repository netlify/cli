const fs = require('fs').promises
const path = require('path')
const util = require('util')

const rimraf = require('rimraf')

const rimrafAsync = util.promisify(rimraf)

const copyDirRecursiveAsync = async (src, dest) => {
  try {
    fs.mkdir(dest, { recursive: true })
  } catch (_) {
    // ignore erros for mkdir
  }

  const childrenItems = await fs.readdir(src)

  await Promise.all(
    childrenItems.map(async (item) => {
      const srcPath = path.join(src, item)
      const destPath = path.join(dest, item)

      const itemStat = await fs.lstat(srcPath)

      if (itemStat.isFile()) {
        fs.copyFile(srcPath, destPath)
      } else {
        await copyDirRecursiveAsync(srcPath, destPath)
      }
    }),
  )
}

const ensureFilePathAsync = async (filePath) => {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
  } catch (_) {
    // ignore any errors with mkdir - it will throw if the path already exists.
  }
}

const removeRecursiveAsync = async (filePath) => {
  await rimrafAsync(filePath)
}

module.exports = {
  copyDirRecursiveAsync,
  ensureFilePathAsync,
  removeRecursiveAsync,
}
