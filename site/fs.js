import { promises as fs } from 'fs'
import { join, dirname } from 'path'

export const copyDirRecursiveAsync = async (src, dest) => {
  try {
    fs.mkdir(dest, { recursive: true })
  } catch {
    // ignore erros for mkdir
  }

  const childrenItems = await fs.readdir(src)

  await Promise.all(
    childrenItems.map(async (item) => {
      const srcPath = join(src, item)
      const destPath = join(dest, item)

      const itemStat = await fs.lstat(srcPath)

      if (itemStat.isFile()) {
        fs.copyFile(srcPath, destPath)
      } else {
        await copyDirRecursiveAsync(srcPath, destPath)
      }
    }),
  )
}

export const ensureFilePathAsync = async (filePath) => {
  try {
    await fs.mkdir(dirname(filePath), { recursive: true })
  } catch {
    // ignore any errors with mkdir - it will throw if the path already exists.
  }
}
