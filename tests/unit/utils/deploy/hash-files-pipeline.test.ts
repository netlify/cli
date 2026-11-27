import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { expect, onTestFinished, test, vi } from 'vitest'

import type { File } from '../../../../src/utils/deploy/file.js'
import hashFiles from '../../../../src/utils/deploy/hash-files.js'
import { hasherCtor } from '../../../../src/utils/deploy/hasher-segments.js'
import { deployFileNormalizer } from '../../../../src/utils/deploy/process-files.js'
import { getUploadList } from '../../../../src/utils/deploy/util.js'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, createReadStream: vi.fn(actual.createReadStream) }
})

const createDirectory = async (files: Record<string, string | Buffer> = {}) => {
  const directory = await mkdtemp(join(tmpdir(), 'cli-hash-files-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))

  await Promise.all(
    Object.entries(files).map(async ([name, content]) => {
      const filepath = join(directory, name)
      await mkdir(dirname(filepath), { recursive: true })
      await writeFile(filepath, content)
    }),
  )

  return directory
}

test.each([1, 4])('hashes complete file bytes with concurrency %i', async (concurrentHash) => {
  const contents = {
    'empty.txt': Buffer.alloc(0),
    'nested/café.txt': Buffer.from('Hello, 世界!\n'),
    'large.bin': Buffer.from(Array.from({ length: 2_097_157 }, (_, index) => (index + (index >>> 16)) % 256)),
  }
  const directory = await createDirectory(contents)

  for (const hashAlgorithm of [undefined, 'sha256']) {
    const expectedFiles = Object.fromEntries(
      Object.entries(contents).map(([name, bytes]) => [
        name,
        createHash(hashAlgorithm ?? 'sha1')
          .update(bytes)
          .digest('hex'),
      ]),
    )
    const { files, filesShaMap } = await hashFiles({
      directories: [directory],
      filter: () => true,
      concurrentHash,
      hashAlgorithm,
      statusCb() {},
    })

    expect(files).toEqual(expectedFiles)
    expect(Object.keys(filesShaMap).sort()).toEqual(Object.values(expectedFiles).sort())
    for (const [name, hash] of Object.entries(expectedFiles)) {
      expect(filesShaMap[hash]).toEqual([
        expect.objectContaining({ filepath: join(directory, name), normalizedPath: name, hash, assetType: 'file' }),
      ])
    }
  }
})

test('keeps every upload path for identical content and rehashes changed files on the next run', async () => {
  const directory = await createDirectory({ 'one.txt': 'same', 'nested/two.txt': 'same' })
  const options = {
    directories: [directory],
    filter: () => true,
    concurrentHash: 4,
    statusCb() {},
  }
  const hash = createHash('sha1').update('same').digest('hex')
  const first = await hashFiles(options)

  expect(first.files).toEqual({ 'one.txt': hash, 'nested/two.txt': hash })
  expect(Object.keys(first.filesShaMap)).toEqual([hash])
  const uploads = getUploadList([hash], first.filesShaMap) as File[]
  expect(uploads.map(({ normalizedPath }) => normalizedPath).sort()).toEqual(['nested/two.txt', 'one.txt'])
  expect(uploads.map(({ filepath }) => filepath).sort()).toEqual(
    [join(directory, 'nested/two.txt'), join(directory, 'one.txt')].sort(),
  )

  await writeFile(join(directory, 'one.txt'), 'changed')
  const second = await hashFiles(options)
  const changedHash = createHash('sha1').update('changed').digest('hex')
  expect(second.files).toEqual({ 'one.txt': changedHash, 'nested/two.txt': hash })
  expect(second.filesShaMap[hash]).toEqual([
    expect.objectContaining({ filepath: join(directory, 'nested/two.txt'), normalizedPath: 'nested/two.txt', hash }),
  ])
  expect(second.filesShaMap[changedHash]).toEqual([
    expect.objectContaining({ filepath: join(directory, 'one.txt'), normalizedPath: 'one.txt', hash: changedHash }),
  ])
  expect(first.files).toEqual({ 'one.txt': hash, 'nested/two.txt': hash })
  expect(first.filesShaMap[hash]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ filepath: join(directory, 'one.txt'), normalizedPath: 'one.txt', hash }),
      expect.objectContaining({ filepath: join(directory, 'nested/two.txt'), normalizedPath: 'nested/two.txt', hash }),
    ]),
  )
  expect(first.filesShaMap[hash]).toHaveLength(2)
})

test('prunes excluded files and directories before hashing', async () => {
  const directory = await createDirectory({
    'public/index.html': 'page',
    'public/ignored.txt': 'excluded file',
    'private/nested/secret.txt': 'excluded directory',
  })
  const filter = vi.fn(
    (filepath: string) => ![join(directory, 'private'), join(directory, 'public/ignored.txt')].includes(filepath),
  )
  const statusCb = vi.fn()
  const result = await hashFiles({ directories: [directory], filter, concurrentHash: 4, statusCb })

  expect(result.files).toEqual({ 'public/index.html': createHash('sha1').update('page').digest('hex') })
  expect(Object.values(result.filesShaMap).flat()).toEqual([
    expect.objectContaining({ normalizedPath: 'public/index.html' }),
  ])
  expect(filter).not.toHaveBeenCalledWith(join(directory, 'private/nested'))
  expect(statusCb).toHaveBeenCalledExactlyOnceWith({
    type: 'hashing',
    msg: `Hashing ${join('public', 'index.html')}`,
    phase: 'progress',
  })
})

test('preserves deploy artifact namespaces when several roots have the same relative filename', async () => {
  const roots = ['public', '.netlify/edge-functions-dist', '.netlify/deploy-config', '.netlify/internal/db/migrations']
  const directory = await createDirectory(Object.fromEntries(roots.map((root) => [`${root}/manifest.json`, root])))
  const directories = roots.map((root) => join(directory, root))
  const expectedPaths = [
    'manifest.json',
    '.netlify/internal/edge-functions/manifest.json',
    '.netlify/deploy-config/manifest.json',
    '.netlify/internal/db/migrations/manifest.json',
  ]
  const { files, filesShaMap } = await hashFiles({
    directories,
    filter: () => true,
    concurrentHash: 4,
    normalizer: deployFileNormalizer.bind(null, directory),
    statusCb() {},
  })

  expect(files).toEqual(
    Object.fromEntries(
      expectedPaths.map((name, index) => [name, createHash('sha1').update(roots[index]).digest('hex')]),
    ),
  )
  for (const [index, name] of expectedPaths.entries()) {
    expect(filesShaMap[files[name]]).toEqual([
      expect.objectContaining({ normalizedPath: name, filepath: join(directories[index], 'manifest.json') }),
    ])
  }
})

test('returns an empty manifest when no files survive the filter', async () => {
  const directory = await createDirectory({ 'ignored.txt': 'excluded' })
  const statusCb = vi.fn()
  const result = await hashFiles({ directories: [directory], filter: () => false, concurrentHash: 4, statusCb })

  expect(result).toEqual({ files: {}, filesShaMap: {} })
  expect(statusCb).not.toHaveBeenCalled()
})

test('rejects a missing input directory instead of returning a partial manifest', async () => {
  const directory = await createDirectory({ 'first.txt': 'readable' })
  const missing = join(directory, 'missing')

  await expect(
    hashFiles({ directories: [directory, missing], filter: () => true, concurrentHash: 1, statusCb() {} }),
  ).rejects.toMatchObject({ code: 'ENOENT', path: missing })
})

test('propagates a file read failure and destroys the hashing pipeline', async () => {
  const directory = await createDirectory({ 'first.txt': 'readable' })
  const missing = join(directory, 'removed-after-discovery.txt')
  const source = Readable.from([{ filepath: join(directory, 'first.txt') }, { filepath: missing }])
  const hasher = hasherCtor({ concurrentHash: 1, hashAlgorithm: 'sha1' })
  const onClose = vi.fn()
  hasher.on('close', onClose)
  const received: unknown[] = []
  const sink = new Writable({
    objectMode: true,
    write(file, _encoding, callback) {
      received.push(file)
      callback()
    },
  })

  await expect(pipeline(source, hasher, sink)).rejects.toMatchObject({ code: 'ENOENT', path: missing })
  expect(received).toEqual([expect.objectContaining({ filepath: join(directory, 'first.txt') })])
  expect(source.destroyed).toBe(true)
  expect(onClose).toHaveBeenCalledOnce()
  expect(sink.destroyed).toBe(true)
})

test('rejects when a discovered file disappears before it can be read', async () => {
  const directory = await createDirectory({ 'removed.txt': 'present during discovery' })
  const missing = join(directory, 'removed.txt')
  const { createReadStream } = await vi.importActual<typeof import('node:fs')>('node:fs')
  const read = vi.mocked(fs.createReadStream).mockImplementationOnce((filepath, options) => {
    if (filepath === missing) {
      fs.unlinkSync(missing)
    }
    return createReadStream(filepath, options)
  })
  onTestFinished(() => {
    read.mockReset()
  })

  await expect(
    hashFiles({ directories: [directory], filter: () => true, concurrentHash: 1, statusCb() {} }),
  ).rejects.toMatchObject({ code: 'ENOENT', syscall: 'open', path: missing })
})
