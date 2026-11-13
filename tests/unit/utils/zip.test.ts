import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, expect, test, vi } from 'vitest'
import yauzl from 'yauzl'

import { extractZip } from '../../../src/utils/zip.js'
import { createZip } from '../../helpers/zip.js'

let root: string
let dir: string
let zipPath: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'cli-extract-zip-'))
  dir = join(root, 'extracted')
  zipPath = join(root, 'function.zip')

  return async () => {
    await rm(root, { recursive: true, force: true })
  }
})

test.each([false, true])('extracts complete binary files and empty directories (deflate: %s)', async (deflate) => {
  const contents = Buffer.from(Array.from({ length: 128 * 1024 }, (_, index) => index % 256))
  await writeFile(
    zipPath,
    createZip([{ name: 'nested/日本語.bin', contents, deflate }, { name: 'empty/' }, { name: 'zero.txt' }]),
  )

  await extractZip(zipPath, { dir })

  expect(await readFile(join(dir, 'nested', '日本語.bin'))).toEqual(contents)
  expect((await stat(join(dir, 'empty'))).isDirectory()).toBe(true)
  expect(await readFile(join(dir, 'zero.txt'))).toHaveLength(0)
})

test('accepts an empty archive', async () => {
  await writeFile(zipPath, createZip([]))

  await extractZip(zipPath, { dir })

  expect(await readdir(dir)).toEqual([])
})

test('skips macOS metadata and continues extracting later entries', async () => {
  await writeFile(
    zipPath,
    createZip([
      { name: '__MACOSX/._handler.js', contents: 'metadata' },
      { name: 'handler.js', contents: 'handler' },
    ]),
  )

  await extractZip(zipPath, { dir })

  expect(await readdir(dir)).toEqual(['handler.js'])
  expect(await readFile(join(dir, 'handler.js'), 'utf8')).toBe('handler')
})

test('overwrites a previous extraction without leaving trailing bytes', async () => {
  await writeFile(zipPath, createZip([{ name: 'handler.js', contents: 'first version of the handler' }]))
  await extractZip(zipPath, { dir })
  await writeFile(zipPath, createZip([{ name: 'handler.js', contents: 'new' }]))

  await extractZip(zipPath, { dir })

  expect(await readFile(join(dir, 'handler.js'), 'utf8')).toBe('new')
})

test.each(['relative', 'absolute', 'nested'] as const)(
  'rejects an archive entry outside the target: %s',
  async (kind) => {
    const outside = join(root, 'outside.txt')
    const name = {
      relative: '../outside.txt',
      absolute: outside.replaceAll('\\', '/'),
      nested: 'nested/../../outside.txt',
    }[kind]
    await writeFile(outside, 'untouched')
    await writeFile(zipPath, createZip([{ name, contents: 'overwritten' }]))

    await expect(extractZip(zipPath, { dir })).rejects.toThrow(/invalid relative path|absolute path/)

    expect(await readFile(outside, 'utf8')).toBe('untouched')
    expect(await readdir(dir)).toEqual([])
  },
)

test('rejects an invalid archive', async () => {
  await writeFile(zipPath, 'not a ZIP archive')

  await expect(extractZip(zipPath, { dir })).rejects.toThrow()

  expect(await readdir(dir)).toEqual([])
})

test('closes the archive after a truncated stream and rejects without extracting later entries', async (t) => {
  const events = vi.spyOn(yauzl.ZipFile.prototype, 'emit')
  t.onTestFinished(() => {
    events.mockRestore()
  })
  await writeFile(
    zipPath,
    createZip([
      { name: 'broken.txt', contents: 'short', deflate: true, uncompressedSize: 100 },
      { name: 'later.txt', contents: 'must not be extracted' },
    ]),
  )

  await expect(extractZip(zipPath, { dir })).rejects.toThrow(/not enough bytes/)

  await expect(stat(join(dir, 'later.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
  await expect.poll(() => events.mock.calls.some(([event]) => event === 'close')).toBe(true)
})

test('closes the archive after a write failure and rejects without extracting later entries', async (t) => {
  const events = vi.spyOn(yauzl.ZipFile.prototype, 'emit')
  t.onTestFinished(() => {
    events.mockRestore()
  })
  await mkdir(join(dir, 'blocked.txt'), { recursive: true })
  await writeFile(
    zipPath,
    createZip([
      { name: 'blocked.txt', contents: 'cannot replace a directory' },
      { name: 'later.txt', contents: 'must not be extracted' },
    ]),
  )

  await expect(extractZip(zipPath, { dir })).rejects.toThrow()

  expect((await stat(join(dir, 'blocked.txt'))).isDirectory()).toBe(true)
  await expect(stat(join(dir, 'later.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
  await expect.poll(() => events.mock.calls.some(([event]) => event === 'close')).toBe(true)
})

test.skipIf(process.platform === 'win32')('preserves executable permissions without special mode bits', async () => {
  await writeFile(zipPath, createZip([{ name: 'handler', contents: '#!/bin/sh\n', mode: 0o106755 }]))
  const reference = join(root, 'executable')
  await writeFile(reference, '', { mode: 0o755 })

  await extractZip(zipPath, { dir })

  expect((await stat(join(dir, 'handler'))).mode & 0o7777).toBe((await stat(reference)).mode & 0o7777)
})

test.skipIf(process.platform === 'win32')('extracts relative symlinks to files within the archive', async () => {
  await writeFile(
    zipPath,
    createZip([
      { name: 'handler.js', contents: 'handler' },
      { name: 'alias.js', contents: 'handler.js', mode: 0o120777 },
    ]),
  )

  await extractZip(zipPath, { dir })

  expect(await readlink(join(dir, 'alias.js'))).toBe('handler.js')
  expect(await readFile(join(dir, 'alias.js'), 'utf8')).toBe('handler')
})

test.skipIf(process.platform === 'win32')('accepts a destination directory reached through a symlink', async () => {
  const target = join(root, 'target')
  await mkdir(target)
  await symlink(target, dir)
  await writeFile(zipPath, createZip([{ name: 'handler.js', contents: 'handler' }]))

  await extractZip(zipPath, { dir })

  expect(await readFile(join(target, 'handler.js'), 'utf8')).toBe('handler')
})

test.skipIf(process.platform === 'win32').each(['existing', 'archive'])(
  'rejects writes through an %s directory symlink outside the target',
  async (source) => {
    const outside = join(root, 'outside')
    await mkdir(outside)
    await writeFile(join(outside, 'protected.txt'), 'untouched')
    await mkdir(dir)
    if (source === 'existing') {
      await symlink(outside, join(dir, 'link'))
    }
    await writeFile(
      zipPath,
      createZip([
        ...(source === 'archive' ? [{ name: 'link', contents: '../outside', mode: 0o120777 }] : []),
        { name: 'link/protected.txt', contents: 'overwritten' },
        { name: 'later.txt', contents: 'must not be extracted' },
      ]),
    )

    await expect(extractZip(zipPath, { dir })).rejects.toThrow(/Out of bound path/)

    expect(await readFile(join(outside, 'protected.txt'), 'utf8')).toBe('untouched')
    await expect(stat(join(dir, 'later.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
  },
)

test.skipIf(process.platform === 'win32').each(['existing', 'archive'])(
  'replaces an %s file symlink without overwriting its target',
  async (source) => {
    const outside = join(root, 'outside.txt')
    await writeFile(outside, 'untouched')
    await mkdir(dir)
    if (source === 'existing') {
      await symlink(outside, join(dir, 'handler.js'))
    }
    await writeFile(
      zipPath,
      createZip([
        ...(source === 'archive' ? [{ name: 'handler.js', contents: '../outside.txt', mode: 0o120777 }] : []),
        { name: 'handler.js', contents: 'handler' },
      ]),
    )

    await extractZip(zipPath, { dir })

    expect(await readFile(outside, 'utf8')).toBe('untouched')
    expect((await lstat(join(dir, 'handler.js'))).isSymbolicLink()).toBe(false)
    expect(await readFile(join(dir, 'handler.js'), 'utf8')).toBe('handler')
  },
)
