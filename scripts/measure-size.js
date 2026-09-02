/*
 * Measures the size impact of a change and writes the numbers as `.delta.*` files for
 * `netlify/delta-action` to compare against `main` and post on the PR. See
 * `.github/workflows/benchmark.yml`.
 */

import { execFile } from 'node:child_process'
import { readdir, readFile, lstat, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** cacache stores downloaded tarballs under this key prefix; registry metadata shares the prefix. */
const TARBALL_KEY_SUFFIX = '.tgz'

const walkFiles = async (dir) => {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return []
    }
    throw error
  }

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name)
      return entry.isDirectory() ? walkFiles(entryPath) : [entryPath]
    }),
  )
  return nested.flat()
}

/**
 * Total bytes of every package tarball npm downloaded into `cacheDir`.
 *
 * Read from cacache's index rather than by measuring the cache on disk: the index records an exact
 * byte count per entry, and lets us exclude cached registry metadata, which is downloaded too but
 * fluctuates as unrelated packages publish. Tarballs for a published version are immutable, so a
 * given lockfile always produces the same total.
 */
export const sumCachedTarballBytes = async (cacheDir) => {
  const buckets = await walkFiles(path.join(cacheDir, '_cacache', 'index-v5'))

  // Buckets are append-only logs, so one key can appear several times. Keep the last entry per key
  // rather than summing every line, which would count a re-fetched tarball more than once.
  const sizeByKey = new Map()

  for (const bucket of buckets) {
    const contents = await readFile(bucket, 'utf8')
    for (const line of contents.split('\n')) {
      const separator = line.indexOf('\t')
      if (separator === -1) {
        continue
      }
      let entry
      try {
        entry = JSON.parse(line.slice(separator + 1))
      } catch {
        // A partially written line is normal in an append-only log.
        continue
      }
      if (entry?.key?.endsWith(TARBALL_KEY_SUFFIX) && typeof entry.size === 'number') {
        sizeByKey.set(entry.key, entry.size)
      }
    }
  }

  return [...sizeByKey.values()].reduce((total, size) => total + size, 0)
}

/**
 * Total bytes of the files under `dir`.
 *
 * Uses real file sizes rather than `du`, which reports disk blocks and so inflates a tree of many
 * small files by an amount that varies with the filesystem. Symlinks are measured as links, not
 * followed, so `node_modules/.bin` doesn't count binaries twice.
 */
export const directoryBytes = async (dir) => {
  const files = await walkFiles(dir)
  const sizes = await Promise.all(
    files.map(async (file) => {
      try {
        return (await lstat(file)).size
      } catch {
        return 0
      }
    }),
  )
  return sizes.reduce((total, size) => total + size, 0)
}

/** Renders one metric in the two-line shape `delta-action` parses: value, then `unit (label)`. */
export const formatDelta = (value, unit, label) => `${Math.round(value).toString()}\n${unit} (${label})\n`

/** Counts installed packages by looking for the manifests npm wrote, including nested copies. */
const countPackages = async (nodeModulesDir) => {
  const files = await walkFiles(nodeModulesDir)
  return files.filter((file) => path.basename(file) === 'package.json').length
}

/**
 * Builds the tarball a release would publish, installs it the way a user would, and reports what
 * that cost. Measuring a real install rather than the repo's own `node_modules` is what lets these
 * numbers cover our own package contents as well as our dependencies.
 */
const measure = async (repoDir, scratchDir) => {
  const packDir = path.join(scratchDir, 'pack')
  const installDir = path.join(scratchDir, 'install')
  const cacheDir = path.join(scratchDir, 'npm-cache')
  await mkdir(packDir, { recursive: true })
  await mkdir(installDir, { recursive: true })

  const { stdout: packStdout } = await execFileAsync(
    'npm',
    ['pack', '--json', '--pack-destination', packDir, '--silent'],
    { cwd: repoDir, maxBuffer: 64 * 1024 * 1024 },
  )
  const [packed] = JSON.parse(packStdout)
  const tarballPath = path.join(packDir, packed.filename)

  await writeFile(
    path.join(installDir, 'package.json'),
    `${JSON.stringify({ name: 'size-probe', version: '1.0.0', private: true }, null, 2)}\n`,
  )

  // `--ignore-scripts` keeps this deterministic and safe; it means the total is what npm downloads,
  // not what a dependency's own postinstall might fetch afterwards.
  await execFileAsync(
    'npm',
    [
      'install',
      tarballPath,
      '--omit=dev',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--cache',
      cacheDir,
      '--loglevel',
      'error',
    ],
    { cwd: installDir, maxBuffer: 64 * 1024 * 1024 },
  )

  const nodeModulesDir = path.join(installDir, 'node_modules')
  // The CLI tarball is installed from disk, so it never lands in the cache -- add it back to get
  // the full download a user would perform.
  const dependencyTarballBytes = await sumCachedTarballBytes(cacheDir)

  return {
    packageDownloadBytes: packed.size,
    totalDownloadBytes: dependencyTarballBytes + packed.size,
    installedBytes: await directoryBytes(nodeModulesDir),
    dependencyCount: await countPackages(nodeModulesDir),
  }
}

const main = async () => {
  const repoDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const scratchDir = await mkdtemp(path.join(process.env.RUNNER_TEMP ?? tmpdir(), 'measure-size-'))

  try {
    const result = await measure(repoDir, scratchDir)

    const metrics = [
      ['.delta.downloadSizePackage', result.packageDownloadBytes / 1024, 'kb', 'Download size (CLI package)'],
      ['.delta.downloadSizeInstall', result.totalDownloadBytes / 1024, 'kb', 'Download size (full install)'],
      ['.delta.installedSize', result.installedBytes / 1024, 'kb', 'Installed size'],
      ['.delta.dependencyCount', result.dependencyCount, '', 'Dependency count'],
    ]

    for (const [filename, value, unit, label] of metrics) {
      await writeFile(path.join(repoDir, filename), formatDelta(value, unit, label))
      console.log(`${label}: ${Math.round(value).toLocaleString()} ${unit}`.trim())
    }
  } finally {
    await rm(scratchDir, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
