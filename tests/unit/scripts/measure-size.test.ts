import { mkdtemp, mkdir, writeFile, rm, lstat, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { countPackageRoots, directoryBytes, formatDelta, sumCachedTarballBytes } from '../../../scripts/measure-size.js'

let workDir: string

beforeEach(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), 'measure-size-'))
})

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true })
})

/**
 * Writes a cacache index bucket. Real buckets are append-only logs of `<hash>\t<json>` lines, which
 * is the detail most of these tests exist to pin down.
 */
const writeIndexBucket = async (cacheDir: string, bucketName: string, entries: object[]) => {
  const bucketDir = path.join(cacheDir, '_cacache', 'index-v5', 'aa', 'bb')
  await mkdir(bucketDir, { recursive: true })
  const contents = entries.map((entry) => `0000000000\t${JSON.stringify(entry)}`).join('\n')
  await writeFile(path.join(bucketDir, bucketName), `${contents}\n`)
}

const tarballEntry = (name: string, version: string, size: number) => ({
  key: `make-fetch-happen:request-cache:https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
  integrity: 'sha512-fake',
  time: 1_770_825_313_018,
  size,
})

describe('sumCachedTarballBytes', () => {
  test('sums the byte size of every cached tarball', async () => {
    await writeIndexBucket(workDir, 'bucket1', [tarballEntry('chalk', '5.3.0', 13_397)])
    await writeIndexBucket(workDir, 'bucket2', [tarballEntry('diff', '4.0.4', 98_055)])

    expect(await sumCachedTarballBytes(workDir)).toBe(111_452)
  })

  test('ignores cached registry metadata, counting only tarballs', async () => {
    await writeIndexBucket(workDir, 'bucket1', [
      tarballEntry('chalk', '5.3.0', 13_397),
      {
        key: 'make-fetch-happen:request-cache:https://registry.npmjs.org/chalk',
        integrity: 'sha512-fake',
        time: 1_770_825_313_018,
        size: 5_000_000,
      },
    ])

    expect(await sumCachedTarballBytes(workDir)).toBe(13_397)
  })

  test('counts a re-fetched tarball once rather than once per log entry', async () => {
    // cacache appends rather than rewrites, so the same key legitimately appears more than once.
    await writeIndexBucket(workDir, 'bucket1', [
      tarballEntry('chalk', '5.3.0', 13_397),
      tarballEntry('chalk', '5.3.0', 14_001),
    ])

    expect(await sumCachedTarballBytes(workDir)).toBe(14_001)
  })

  test('skips unparseable lines rather than throwing', async () => {
    const bucketDir = path.join(workDir, '_cacache', 'index-v5', 'aa', 'bb')
    await mkdir(bucketDir, { recursive: true })
    await writeFile(
      path.join(bucketDir, 'bucket1'),
      `0000000000\t{"truncated":\n0000000000\t${JSON.stringify(tarballEntry('chalk', '5.3.0', 13_397))}\n`,
    )

    expect(await sumCachedTarballBytes(workDir)).toBe(13_397)
  })

  test('returns zero when nothing was downloaded', async () => {
    expect(await sumCachedTarballBytes(path.join(workDir, 'never-created'))).toBe(0)
  })
})

describe('directoryBytes', () => {
  test('sums real file sizes across nested directories', async () => {
    await mkdir(path.join(workDir, 'nested'), { recursive: true })
    await writeFile(path.join(workDir, 'a.js'), 'x'.repeat(100))
    await writeFile(path.join(workDir, 'nested', 'b.js'), 'x'.repeat(250))

    expect(await directoryBytes(workDir)).toBe(350)
  })

  test('counts a symlink itself rather than following it to its target', async () => {
    // `node_modules/.bin` is full of symlinks; following them would count binaries repeatedly.
    const target = path.join(workDir, 'real.js')
    const link = path.join(workDir, 'link.js')
    await writeFile(target, 'x'.repeat(100))
    await symlink(target, link)

    expect(await directoryBytes(workDir)).toBe(100 + (await lstat(link)).size)
  })

  test('returns zero for a directory that does not exist', async () => {
    expect(await directoryBytes(path.join(workDir, 'never-created'))).toBe(0)
  })
})

describe('countPackageRoots', () => {
  const writeManifest = async (...segments: string[]) => {
    const dir = path.join(workDir, ...segments)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'package.json'), '{}')
  }

  test('counts unscoped and scoped packages', async () => {
    await writeManifest('node_modules', 'chalk')
    await writeManifest('node_modules', '@netlify', 'api')
    await writeManifest('node_modules', '@netlify', 'blobs')

    expect(await countPackageRoots(path.join(workDir, 'node_modules'))).toBe(3)
  })

  test('counts nested duplicate copies npm hoisted separately', async () => {
    await writeManifest('node_modules', 'chalk')
    await writeManifest('node_modules', 'chalk', 'node_modules', 'ansi-styles')

    expect(await countPackageRoots(path.join(workDir, 'node_modules'))).toBe(2)
  })

  test('ignores manifests a package ships outside its root', async () => {
    await writeManifest('node_modules', 'chalk')
    await writeManifest('node_modules', 'chalk', 'dist')
    await writeManifest('node_modules', 'chalk', 'test', 'fixtures', 'project')

    expect(await countPackageRoots(path.join(workDir, 'node_modules'))).toBe(1)
  })

  test('ignores directories npm writes that are not packages', async () => {
    await writeManifest('node_modules', 'chalk')
    await mkdir(path.join(workDir, 'node_modules', '.bin'), { recursive: true })
    await mkdir(path.join(workDir, 'node_modules', 'empty-dir'), { recursive: true })

    expect(await countPackageRoots(path.join(workDir, 'node_modules'))).toBe(1)
  })

  test('returns zero when nothing was installed', async () => {
    expect(await countPackageRoots(path.join(workDir, 'never-created'))).toBe(0)
  })
})

describe('formatDelta', () => {
  test('renders the value and label in the format delta-action parses', () => {
    expect(formatDelta(1234, 'kb', 'Download size (full install)')).toBe('1234\nkb (Download size (full install))\n')
  })

  test('omits the unit for unitless metrics, keeping the leading space', () => {
    expect(formatDelta(1093, '', 'Dependency count')).toBe('1093\n (Dependency count)\n')
  })

  test('rounds fractional values, since delta-action expects an integer', () => {
    expect(formatDelta(1234.6, 'kb', 'Installed size')).toBe('1235\nkb (Installed size)\n')
  })
})
