/*
 * This script runs at pack time (`prepack`), before the tarball is assembled.
 *
 * We build with `sourceMap` and `declarationMap` enabled so that local development against `dist/`
 * has working maps. Those maps are useless to end users, though: they reference `../src/*.ts`, and
 * `src` is not in the package's `files` list, so every map in a published install points at a file
 * that isn't there. They accounted for roughly half of the published package, so we strip them
 * here rather than shipping dead weight.
 *
 * This is idempotent — `npm publish` is invoked more than once per release (see
 * `.github/workflows/release-please.yml`), and the second run should be a no-op.
 */

import { readdir, rm, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, '..', 'dist')
// `tsc --incremental` decides what to emit from this file alone, not from what's on disk. Stripping
// maps out from under it would otherwise leave a subsequent local build convinced it has nothing to
// do, silently yielding a `dist/` with no maps (or, after `npm run clean`, no `dist/` at all).
const BUILD_INFO_FILE = path.join(__dirname, '..', 'tsconfig.build.tsbuildinfo')

// Matches the trailing `//# sourceMappingURL=...` annotation left behind once the map is gone.
const SOURCE_MAPPING_URL_RE = /^\/\/# sourceMappingURL=.*$\n?/gm

const walk = async (dir) => {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name)
      return entry.isDirectory() ? walk(entryPath) : [entryPath]
    }),
  )
  return files.flat()
}

const stripSourceMaps = async () => {
  const files = await walk(DIST_DIR)

  if (files.length === 0) {
    console.error('strip-source-maps: no dist/ output found, nothing to do')
    return
  }

  const maps = files.filter((file) => file.endsWith('.map'))
  const annotated = files.filter((file) => file.endsWith('.js') || file.endsWith('.d.ts'))

  // Collect sizes first and sum at the end: `total += await size(file)` would read `total` before
  // awaiting and clobber every concurrent update.
  const bytesRemoved = (
    await Promise.all(
      maps.map(async (file) => {
        const { size } = await stat(file)
        await rm(file)
        return size
      }),
    )
  ).reduce((total, size) => total + size, 0)

  let annotationsRemoved = 0
  await Promise.all(
    annotated.map(async (file) => {
      const contents = await readFile(file, 'utf8')
      const stripped = contents.replace(SOURCE_MAPPING_URL_RE, '')
      if (stripped !== contents) {
        annotationsRemoved += 1
        await writeFile(file, stripped)
      }
    }),
  )

  await rm(BUILD_INFO_FILE, { force: true })

  console.error(
    `strip-source-maps: removed ${maps.length.toString()} map file(s) (${(bytesRemoved / 1024 / 1024).toFixed(
      2,
    )} MB) and ${annotationsRemoved.toString()} sourceMappingURL annotation(s)`,
  )
}

await stripSourceMaps()
