import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import execa from 'execa'
import fetch from 'node-fetch'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { uploadSourceZip } from '../../../../src/utils/deploy/upload-source-zip.js'

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}))

vi.mock('../../../../src/utils/command-helpers.js', () => ({
  log: vi.fn(),
  warn: vi.fn(),
}))

const zippedPaths = async (workDir: string, files: string[]) => {
  const sourceDir = join(workDir, 'source')
  for (const file of files) {
    await mkdir(dirname(join(sourceDir, file)), { recursive: true })
    await writeFile(join(sourceDir, file), '')
  }

  let uploadedZip: Buffer | undefined
  vi.mocked(fetch).mockImplementation((_url, init) => {
    uploadedZip = init?.body as Buffer
    return Promise.resolve({ ok: true, status: 200, statusText: 'OK' } as Awaited<ReturnType<typeof fetch>>)
  })

  await uploadSourceZip({
    sourceDir,
    uploadUrl: 'https://s3.example.com/upload-url',
    filename: 'workspace-snapshots/source.zip',
  })

  const zipPath = join(workDir, 'uploaded.zip')
  await writeFile(zipPath, uploadedZip ?? Buffer.alloc(0))
  const { stdout } = await execa('unzip', ['-Z1', zipPath])
  return stdout.split('\n').filter((path) => !path.endsWith('/'))
}

describe.skipIf(process.platform === 'win32')('uploadSourceZip contents', () => {
  let workDir: string

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'upload-source-zip-'))
  })

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  test('keeps root files that share a prefix with an ignored folder', async () => {
    const paths = await zippedPaths(workDir, [
      'index.html',
      'build.cjs',
      'build.sh',
      'builder.config.js',
      'distribute.js',
      'coverage.md',
      '.gitignore',
      '.github/workflows/ci.yml',
      'src/build/index.js',
    ])

    expect(paths.sort()).toEqual(
      [
        'index.html',
        'build.cjs',
        'build.sh',
        'builder.config.js',
        'distribute.js',
        'coverage.md',
        '.gitignore',
        '.github/workflows/ci.yml',
        'src/build/index.js',
      ].sort(),
    )
  })

  test('leaves out ignored folders and files', async () => {
    const paths = await zippedPaths(workDir, [
      'index.html',
      'node_modules/pkg/index.js',
      '.git/HEAD',
      '.git-credentials',
      '.git-credentials.lock',
      '.netlify/state.json',
      '.next/server.js',
      'dist/app.js',
      'build/app.js',
      'coverage/lcov.info',
      '.env',
      'debug.log',
    ])

    expect(paths).toEqual(['index.html'])
  })

  test('leaves out the .git file of a linked worktree', async () => {
    const paths = await zippedPaths(workDir, ['index.html', '.git', '.gitignore'])

    expect(paths.sort()).toEqual(['.gitignore', 'index.html'])
  })
})
