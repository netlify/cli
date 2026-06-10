import { createWriteStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'

import yauzl, { type Entry, type ZipFile } from 'yauzl'

const openZip = promisify<string, yauzl.Options, ZipFile>(yauzl.open)

const IFMT = 0o170000
const IFDIR = 0o040000
const IFLNK = 0o120000

const readStreamToString = (stream: NodeJS.ReadableStream): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    stream.on('end', () => {
      resolve(Buffer.concat(chunks).toString())
    })
    stream.on('error', reject)
  })

const openReadStream = (zipfile: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> =>
  new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err) reject(err)
      else resolve(stream)
    })
  })

const getExtractedMode = (entryMode: number, isDir: boolean): number => {
  if (entryMode !== 0) return entryMode
  return isDir ? 0o755 : 0o644
}

export const extractZip = async (zipPath: string, { dir }: { dir: string }): Promise<void> => {
  if (!path.isAbsolute(dir)) {
    throw new Error('Target directory is expected to be absolute')
  }

  await fs.mkdir(dir, { recursive: true })
  const resolvedDir = await fs.realpath(dir)

  const zipfile = await openZip(zipPath, { lazyEntries: true })

  await new Promise<void>((resolve, reject) => {
    let canceled = false

    const fail = (err: unknown) => {
      if (canceled) return
      canceled = true
      zipfile.close()
      reject(err instanceof Error ? err : new Error(String(err)))
    }

    zipfile.on('error', fail)
    zipfile.on('close', () => {
      if (!canceled) resolve()
    })

    zipfile.on('entry', (entry: Entry) => {
      void (async () => {
        if (canceled) return

        if (entry.fileName.startsWith('__MACOSX/')) {
          zipfile.readEntry()
          return
        }

        try {
          const mode = (entry.externalFileAttributes >> 16) & 0xffff
          const isSymlink = (mode & IFMT) === IFLNK
          const madeBy = entry.versionMadeBy >> 8
          const isDir =
            (mode & IFMT) === IFDIR ||
            entry.fileName.endsWith('/') ||
            (madeBy === 0 && entry.externalFileAttributes === 16)

          const dest = path.join(resolvedDir, entry.fileName)
          const destDir = isDir ? dest : path.dirname(dest)

          const lexicalRelative = path.relative(resolvedDir, dest)
          if (lexicalRelative.split(path.sep).includes('..') || path.isAbsolute(lexicalRelative)) {
            throw new Error(`Refusing to extract entry outside target directory: ${entry.fileName}`)
          }

          await fs.mkdir(destDir, { recursive: true })

          const canonicalDestDir = await fs.realpath(destDir)
          const relative = path.relative(resolvedDir, canonicalDestDir)
          if (relative.split(path.sep).includes('..')) {
            throw new Error(`Out of bound path "${canonicalDestDir}" found while processing file ${entry.fileName}`)
          }

          if (isDir) {
            zipfile.readEntry()
            return
          }

          const procMode = getExtractedMode(mode, isDir) & 0o777
          const readStream = await openReadStream(zipfile, entry)

          if (isSymlink) {
            const link = await readStreamToString(readStream)
            await fs.symlink(link, dest)
          } else {
            try {
              const existing = await fs.lstat(dest)
              if (existing.isSymbolicLink()) {
                await fs.unlink(dest)
              }
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
            }
            await pipeline(readStream, createWriteStream(dest, { mode: procMode }))
          }

          zipfile.readEntry()
        } catch (err) {
          fail(err)
        }
      })()
    })

    zipfile.readEntry()
  })
}
