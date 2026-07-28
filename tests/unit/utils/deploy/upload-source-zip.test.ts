import { join } from 'node:path'

import type { ExecaReturnValue } from 'execa'
import type { Response } from 'node-fetch'
import { describe, expect, test, vi, beforeEach } from 'vitest'

// Mock all dependencies at the top level
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}))

vi.mock('execa', () => ({
  default: vi.fn(),
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  rm: vi.fn(),
}))

vi.mock('../../../../src/utils/command-helpers.js', () => ({
  log: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('../../../../src/utils/temporary-file.js', () => ({
  temporaryDirectory: vi.fn(),
}))

// Mock OS to return non-Windows platform to avoid platform checks
vi.mock('os', () => ({
  platform: vi.fn().mockReturnValue('darwin'),
}))

const resolveExeca = async () => {
  const mockExeca = await import('execa')
  // @ts-expect-error(types): the execa overloads are awkward to satisfy in a mock
  vi.mocked(mockExeca.default).mockImplementation(() => Promise.resolve({} as ExecaReturnValue))
}

const rejectExeca = async (error: Error) => {
  const mockExeca = await import('execa')
  // @ts-expect-error(types): the execa overloads are awkward to satisfy in a mock
  vi.mocked(mockExeca.default).mockImplementation(() => Promise.reject(error))
}

describe('createSourceZip', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const mockOs = await import('os')
    vi.mocked(mockOs.platform).mockReturnValue('darwin')
    const mockTempFile = await import('../../../../src/utils/temporary-file.js')
    vi.mocked(mockTempFile.temporaryDirectory).mockReturnValue('/tmp/test-temp-dir')
  })

  test('creates the zip and returns its path', async () => {
    await resolveExeca()
    const { createSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')
    const mockExeca = await import('execa')

    const statusCb = vi.fn()
    const zipPath = await createSourceZip({ sourceDir: '/test/source', statusCb })

    expect(zipPath).toBe(join('/tmp/test-temp-dir', 'source.zip'))
    expect(mockExeca.default).toHaveBeenCalledWith(
      'zip',
      expect.arrayContaining(['-r', '-q', join('/tmp/test-temp-dir', 'source.zip'), '.']),
      expect.objectContaining({ cwd: '/test/source' }),
    )
    expect(statusCb).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'source-zip-upload', msg: 'Creating source zip...', phase: 'start' }),
    )
  })

  test('includes the default exclusion patterns', async () => {
    await resolveExeca()
    const { createSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')
    const mockExeca = await import('execa')

    await createSourceZip({ sourceDir: '/test/source' })

    expect(mockExeca.default).toHaveBeenCalledWith(
      'zip',
      expect.arrayContaining(['-x', 'node_modules*', '-x', '.git*', '-x', '.netlify*', '-x', '.env']),
      expect.objectContaining({ cwd: '/test/source' }),
    )
  })

  test('throws EmptySourceZipError when zip exits 12 (nothing to do)', async () => {
    await rejectExeca(
      Object.assign(new Error('Command failed with exit code 12'), {
        exitCode: 12,
        all: 'zip error: Nothing to do! (source.zip)',
      }),
    )
    const { createSourceZip, EmptySourceZipError } = await import('../../../../src/utils/deploy/upload-source-zip.js')
    const mockCommandHelpers = await import('../../../../src/utils/command-helpers.js')
    const mockFs = await import('fs/promises')

    await expect(createSourceZip({ sourceDir: '/test/source' })).rejects.toBeInstanceOf(EmptySourceZipError)
    // An empty zip is not a reported failure.
    expect(mockCommandHelpers.warn).not.toHaveBeenCalled()
    // The temp directory is cleaned up even though nothing was produced.
    expect(mockFs.rm).toHaveBeenCalledWith('/tmp/test-temp-dir', { recursive: true, force: true })
  })

  test('reports and rethrows other zip failures', async () => {
    await rejectExeca(new Error('zip command failed'))
    const { createSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')
    const mockCommandHelpers = await import('../../../../src/utils/command-helpers.js')

    const statusCb = vi.fn()
    await expect(createSourceZip({ sourceDir: '/test/source', statusCb })).rejects.toThrow('zip command failed')

    expect(statusCb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'source-zip-upload',
        phase: 'error',
        msg: 'Failed to create source zip: zip command failed',
      }),
    )
    expect(mockCommandHelpers.warn).toHaveBeenCalledWith('Failed to create source zip: zip command failed')
  })

  test('throws on Windows platform', async () => {
    const mockOs = await import('os')
    vi.mocked(mockOs.platform).mockReturnValue('win32')

    const { createSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')

    const statusCb = vi.fn()
    await expect(createSourceZip({ sourceDir: '/test/source', statusCb })).rejects.toThrow(
      'Source zip upload is not supported on Windows',
    )
    expect(statusCb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'source-zip-upload',
        phase: 'error',
        msg: 'Failed to create source zip: Source zip upload is not supported on Windows',
      }),
    )
  })
})

describe('uploadSourceZip', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const mockFs = await import('fs/promises')
    vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('mock zip content'))
    vi.mocked(mockFs.rm).mockResolvedValue(undefined)
  })

  test('uploads the zip and removes its temp dir', async () => {
    const { uploadSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')
    const mockFetch = await import('node-fetch')
    const mockFs = await import('fs/promises')
    const mockCommandHelpers = await import('../../../../src/utils/command-helpers.js')

    vi.mocked(mockFetch.default).mockResolvedValue({ ok: true, status: 200, statusText: 'OK' } as unknown as Response)

    const statusCb = vi.fn()
    await uploadSourceZip({ zipPath: '/tmp/test-temp-dir/source.zip', uploadUrl: 'https://s3/upload', statusCb })

    expect(mockFetch.default).toHaveBeenCalledWith(
      'https://s3/upload',
      expect.objectContaining({ method: 'PUT', body: Buffer.from('mock zip content') }),
    )
    expect(mockFs.rm).toHaveBeenCalledWith('/tmp/test-temp-dir', { recursive: true, force: true })
    expect(mockCommandHelpers.log).toHaveBeenCalledWith('✔ Source code uploaded')
  })

  test('throws on upload failure but still removes its temp dir', async () => {
    const { uploadSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')
    const mockFetch = await import('node-fetch')
    const mockFs = await import('fs/promises')

    vi.mocked(mockFetch.default).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as unknown as Response)

    await expect(
      uploadSourceZip({ zipPath: '/tmp/test-temp-dir/source.zip', uploadUrl: 'https://s3/upload' }),
    ).rejects.toThrow('Failed to upload zip: Internal Server Error')

    expect(mockFs.rm).toHaveBeenCalledWith('/tmp/test-temp-dir', { recursive: true, force: true })
  })
})
