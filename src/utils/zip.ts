import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'

import yauzl, { type Entry, type ZipFile } from 'yauzl'

const openZip = promisify<string, yauzl.Options, ZipFile>(yauzl.open)

/**
 * Extracts a zip file to a target directory. Drop-in replacement for the
 * unmaintained `extract-zip` package, which hangs forever on Node 24 because
 * its `promisify(stream.pipeline)` usage no longer terminates correctly.
 *
 * Uses yauzl + the modern `node:stream/promises` pipeline directly, which
 * works on Node 20/22/24.
 */
export const extractZip = async (zipPath: string, { dir }: { dir: string }): Promise<void> => {
  const zipfile = await openZip(zipPath, { lazyEntries: true })

  await new Promise<void>((resolve, reject) => {
    let pending = 0
    let endSeen = false
    let errored = false

    const fail = (err: unknown) => {
      if (errored) return
      errored = true
      reject(err instanceof Error ? err : new Error(String(err)))
      zipfile.close()
    }

    const maybeFinish = () => {
      if (endSeen && pending === 0 && !errored) {
        resolve()
      }
    }

    zipfile.on('error', fail)

    zipfile.on('end', () => {
      endSeen = true
      maybeFinish()
    })

    zipfile.on('entry', (entry: Entry) => {
      void (async () => {
        pending += 1
        try {
          // Directory entries end with '/'
          if (entry.fileName.endsWith('/')) {
            await mkdir(path.join(dir, entry.fileName), { recursive: true })
            return
          }

          const destPath = path.join(dir, entry.fileName)
          await mkdir(path.dirname(destPath), { recursive: true })

          const readStream = await new Promise<NodeJS.ReadableStream>((res, rej) => {
            zipfile.openReadStream(entry, (err, stream) => {
              if (err) rej(err)
              else res(stream)
            })
          })

          await pipeline(readStream, createWriteStream(destPath))
        } catch (err) {
          fail(err)
        } finally {
          pending -= 1
          if (!errored) {
            zipfile.readEntry()
            maybeFinish()
          }
        }
      })()
    })

    zipfile.readEntry()
  })
}
