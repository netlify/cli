import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { Response } from 'node-fetch'
import type { ChildProcess } from 'child_process'

// Mock all dependencies at the top level
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}))

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  unlink: vi.fn(),
}))

vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
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

describe('uploadSourceZip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('creates zip and uploads successfully', async () => {
    // Ensure OS platform mock returns non-Windows
    const mockOs = await import('os')
    vi.mocked(mockOs.platform).mockReturnValue('darwin')

    // Import after mocks are set up
    const { uploadSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')

    // Setup mocks using vi.mocked()
    const mockFetch = await import('node-fetch')
    const mockChildProcess = await import('child_process')
    const mockFs = await import('fs/promises')
    const mockCommandHelpers = await import('../../../../src/utils/command-helpers.js')
    const mockTempFile = await import('../../../../src/utils/temporary-file.js')

    vi.mocked(mockFetch.default).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as unknown as Response)

    vi.mocked(mockChildProcess.execFile).mockImplementation((_command, _args, _options, callback) => {
      if (callback) {
        callback(null, '', '')
      }
      return {} as ChildProcess
    })

    vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('mock zip content'))
    vi.mocked(mockCommandHelpers.log).mockImplementation(() => {})
    vi.mocked(mockTempFile.temporaryDirectory).mockReturnValue('/tmp/test-temp-dir')

    const mockStatusCb = vi.fn()

    await uploadSourceZip({
      sourceDir: '/test/source',
      uploadUrl: 'https://s3.example.com/upload-url',
      filename: 'test-source.zip',
      statusCb: mockStatusCb,
    })

    expect(mockChildProcess.execFile).toHaveBeenCalledWith(
      'zip',
      expect.arrayContaining(['-r', expect.stringMatching(/test-source\.zip$/), '.']),
      expect.objectContaining({
        cwd: '/test/source',
        maxBuffer: 104857600,
      }),
      expect.any(Function),
    )

    expect(mockFetch.default).toHaveBeenCalledWith(
      'https://s3.example.com/upload-url',
      expect.objectContaining({
        method: 'PUT',
        body: Buffer.from('mock zip content'),
      }),
    )

    expect(mockStatusCb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'source-zip-upload',
        msg: 'Creating source zip...',
        phase: 'start',
      }),
    )

    expect(mockFs.unlink).toHaveBeenCalledWith(expect.stringMatching(/test-source\.zip$/))
    expect(mockCommandHelpers.log).toHaveBeenCalledWith('✔ Source code uploaded')
  })

  test('handles upload failure correctly', async () => {
    // Ensure OS platform mock returns non-Windows
    const mockOs = await import('os')
    vi.mocked(mockOs.platform).mockReturnValue('darwin')

    const { uploadSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')

    const mockFetch = await import('node-fetch')
    const mockChildProcess = await import('child_process')
    const mockFs = await import('fs/promises')
    const mockCommandHelpers = await import('../../../../src/utils/command-helpers.js')
    const mockTempFile = await import('../../../../src/utils/temporary-file.js')

    vi.mocked(mockFetch.default).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    } as unknown as Response)

    vi.mocked(mockChildProcess.execFile).mockImplementation((_command, _args, _options, callback) => {
      if (callback) {
        callback(null, '', '')
      }
      return {} as ChildProcess
    })

    vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('mock zip content'))
    vi.mocked(mockCommandHelpers.warn).mockImplementation(() => {})
    vi.mocked(mockTempFile.temporaryDirectory).mockReturnValue('/tmp/test-temp-dir')

    const mockStatusCb = vi.fn()

    await expect(
      uploadSourceZip({
        sourceDir: '/test/source',
        uploadUrl: 'https://s3.example.com/upload-url',
        filename: 'test-source.zip',
        statusCb: mockStatusCb,
      }),
    ).rejects.toThrow('Failed to upload zip: Forbidden')

    expect(mockStatusCb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'source-zip-upload',
        phase: 'error',
        msg: expect.stringContaining('Failed to upload source zip') as unknown as string,
      }),
    )

    expect(mockCommandHelpers.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to upload source zip'))
  })

  test('includes proper exclusion patterns in zip command', async () => {
    // Ensure OS platform mock returns non-Windows
    const mockOs = await import('os')
    vi.mocked(mockOs.platform).mockReturnValue('darwin')

    const { uploadSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')

    const mockFetch = await import('node-fetch')
    const mockChildProcess = await import('child_process')
    const mockFs = await import('fs/promises')
    const mockCommandHelpers = await import('../../../../src/utils/command-helpers.js')
    const mockTempFile = await import('../../../../src/utils/temporary-file.js')

    vi.mocked(mockFetch.default).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as unknown as Response)

    vi.mocked(mockChildProcess.execFile).mockImplementation((_command, _args, _options, callback) => {
      if (callback) {
        callback(null, '', '')
      }
      return {} as ChildProcess
    })

    vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('mock zip content'))
    vi.mocked(mockCommandHelpers.log).mockImplementation(() => {})
    vi.mocked(mockTempFile.temporaryDirectory).mockReturnValue('/tmp/test-temp-dir')

    const mockStatusCb = vi.fn()

    await uploadSourceZip({
      sourceDir: '/test/source',
      uploadUrl: 'https://s3.example.com/upload-url',
      filename: 'test-source.zip',
      statusCb: mockStatusCb,
    })

    expect(mockChildProcess.execFile).toHaveBeenCalledWith(
      'zip',
      expect.arrayContaining(['-x', 'node_modules*', '-x', '.git*', '-x', '.netlify*', '-x', '.env']),
      expect.objectContaining({
        cwd: '/test/source',
        maxBuffer: 104857600,
      }),
      expect.any(Function),
    )
  })

  test('throws error on Windows platform', async () => {
    // Mock OS platform to return Windows
    const mockOs = await import('os')
    vi.mocked(mockOs.platform).mockReturnValue('win32')

    const { uploadSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')

    const mockStatusCb = vi.fn()

    await expect(
      uploadSourceZip({
        sourceDir: '/test/source',
        uploadUrl: 'https://s3.example.com/upload-url',
        filename: 'test-source.zip',
        statusCb: mockStatusCb,
      }),
    ).rejects.toThrow('Source zip upload is not supported on Windows')

    // Should call error status callback
    expect(mockStatusCb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'source-zip-upload',
        phase: 'error',
        msg: 'Failed to create source zip: Source zip upload is not supported on Windows',
      }),
    )
  })

  test('handles zip creation failure correctly', async () => {
    // Ensure OS platform mock returns non-Windows
    const mockOs = await import('os')
    vi.mocked(mockOs.platform).mockReturnValue('darwin')

    const { uploadSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')

    const mockChildProcess = await import('child_process')
    const mockCommandHelpers = await import('../../../../src/utils/command-helpers.js')
    const mockTempFile = await import('../../../../src/utils/temporary-file.js')

    // Mock execFile to simulate failure
    vi.mocked(mockChildProcess.execFile).mockImplementation((_command, _args, _options, callback) => {
      if (callback) {
        callback(new Error('zip command failed'), '', 'zip: error creating archive')
      }
      return {} as import('child_process').ChildProcess
    })

    vi.mocked(mockCommandHelpers.warn).mockImplementation(() => {})
    vi.mocked(mockTempFile.temporaryDirectory).mockReturnValue('/tmp/test-temp-dir')

    const mockStatusCb = vi.fn()

    await expect(
      uploadSourceZip({
        sourceDir: '/test/source',
        uploadUrl: 'https://s3.example.com/upload-url',
        filename: 'test-source.zip',
        statusCb: mockStatusCb,
      }),
    ).rejects.toThrow('zip command failed')

    expect(mockStatusCb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'source-zip-upload',
        phase: 'error',
        msg: 'Failed to create source zip: zip command failed',
      }),
    )

    expect(mockCommandHelpers.warn).toHaveBeenCalledWith('Failed to create source zip: zip command failed')
  })

  test('cleans up zip file even when upload fails', async () => {
    // Ensure OS platform mock returns non-Windows
    const mockOs = await import('os')
    vi.mocked(mockOs.platform).mockReturnValue('darwin')

    const { uploadSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')

    const mockFetch = await import('node-fetch')
    const mockChildProcess = await import('child_process')
    const mockFs = await import('fs/promises')
    const mockCommandHelpers = await import('../../../../src/utils/command-helpers.js')
    const mockTempFile = await import('../../../../src/utils/temporary-file.js')

    // Mock successful zip creation but failed upload
    vi.mocked(mockChildProcess.execFile).mockImplementation((_command, _args, _options, callback) => {
      if (callback) {
        callback(null, '', '')
      }
      return {} as import('child_process').ChildProcess
    })

    vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('mock zip content'))
    vi.mocked(mockFetch.default).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as unknown as import('node-fetch').Response)

    vi.mocked(mockCommandHelpers.warn).mockImplementation(() => {})
    vi.mocked(mockTempFile.temporaryDirectory).mockReturnValue('/tmp/test-temp-dir')
    vi.mocked(mockFs.unlink).mockResolvedValue(undefined)

    const mockStatusCb = vi.fn()

    await expect(
      uploadSourceZip({
        sourceDir: '/test/source',
        uploadUrl: 'https://s3.example.com/upload-url',
        filename: 'test-source.zip',
        statusCb: mockStatusCb,
      }),
    ).rejects.toThrow('Failed to upload zip: Internal Server Error')

    // Should still attempt cleanup
    expect(mockFs.unlink).toHaveBeenCalledWith(expect.stringMatching(/test-source\.zip$/))
  })

  test('handles no status callback gracefully', async () => {
    // Ensure OS platform mock returns non-Windows
    const mockOs = await import('os')
    vi.mocked(mockOs.platform).mockReturnValue('darwin')

    const { uploadSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')

    const mockFetch = await import('node-fetch')
    const mockChildProcess = await import('child_process')
    const mockFs = await import('fs/promises')
    const mockCommandHelpers = await import('../../../../src/utils/command-helpers.js')
    const mockTempFile = await import('../../../../src/utils/temporary-file.js')

    vi.mocked(mockFetch.default).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue({ url: 'https://test-source-zip-url.com' }),
    } as unknown as import('node-fetch').Response)

    vi.mocked(mockChildProcess.execFile).mockImplementation((_command, _args, _options, callback) => {
      if (callback) {
        callback(null, '', '')
      }
      return {} as import('child_process').ChildProcess
    })

    vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('mock zip content'))
    vi.mocked(mockCommandHelpers.log).mockImplementation(() => {})
    vi.mocked(mockTempFile.temporaryDirectory).mockReturnValue('/tmp/test-temp-dir')

    // Should not throw when no status callback provided
    const result = await uploadSourceZip({
      sourceDir: '/test/source',
      uploadUrl: 'https://s3.example.com/upload-url',
      filename: 'test-source.zip',
      // No statusCb provided - should use default empty function
    })

    expect(result).toHaveProperty('sourceZipFileName')
  })

  test('creates subdirectories when filename includes path', async () => {
    // Ensure OS platform mock returns non-Windows
    const mockOs = await import('os')
    vi.mocked(mockOs.platform).mockReturnValue('darwin')

    const { uploadSourceZip } = await import('../../../../src/utils/deploy/upload-source-zip.js')

    const mockFetch = await import('node-fetch')
    const mockChildProcess = await import('child_process')
    const mockFs = await import('fs/promises')
    const mockFsSync = await import('fs')
    const mockCommandHelpers = await import('../../../../src/utils/command-helpers.js')
    const mockTempFile = await import('../../../../src/utils/temporary-file.js')

    vi.mocked(mockFetch.default).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as unknown as Response)

    vi.mocked(mockChildProcess.execFile).mockImplementation((_command, _args, _options, callback) => {
      if (callback) {
        callback(null, '', '')
      }
      return {} as ChildProcess
    })

    vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('mock zip content'))
    vi.mocked(mockCommandHelpers.log).mockImplementation(() => {})
    vi.mocked(mockTempFile.temporaryDirectory).mockReturnValue('/tmp/test-temp-dir')
    vi.mocked(mockFsSync.mkdirSync).mockImplementation(() => {})

    const mockStatusCb = vi.fn()

    // Test with a filename that includes a subdirectory path (like the API provides)
    await uploadSourceZip({
      sourceDir: '/test/source',
      uploadUrl: 'https://s3.example.com/upload-url',
      filename: 'workspace-snapshots/source-abc123-def456.zip',
      statusCb: mockStatusCb,
    })

    // Should create the subdirectory before attempting zip creation
    expect(mockFsSync.mkdirSync).toHaveBeenCalledWith('/tmp/test-temp-dir/workspace-snapshots', { recursive: true })

    // Should still call zip command with the full path
    expect(mockChildProcess.execFile).toHaveBeenCalledWith(
      'zip',
      expect.arrayContaining(['-r', '/tmp/test-temp-dir/workspace-snapshots/source-abc123-def456.zip', '.']),
      expect.objectContaining({
        cwd: '/test/source',
        maxBuffer: 104857600,
      }),
      expect.any(Function),
    )
  })
})
