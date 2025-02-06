import { mkdir, readdir, copyFile, lstat } from 'node:fs/promises'
import { join, dirname } from 'node:path'

export const copyDirRecursiveAsync = async (src, dest) => {
  try {
    await mkdir(dest, { recursive: true })
  } catch {
    // ignore errors for mkdir
  }

  const childrenItems = await readdir(src)

  await Promise.all(
    childrenItems.map(async (item) => {
      const srcPath = join(src, item)
      const destPath = join(dest, item)

      const itemStat = await lstat(srcPath)

      if (itemStat.isFile()) {
        await copyFile(srcPath, destPath)
      } else {
        await copyDirRecursiveAsync(srcPath, destPath)
      }
    }),
  )
}

export const ensureFilePathAsync = async (filePath) => {
  try {
    await mkdir(dirname(filePath), { recursive: true })
  } catch {
    // ignore any errors with mkdir - it will throw if the path already exists.
  }
}
