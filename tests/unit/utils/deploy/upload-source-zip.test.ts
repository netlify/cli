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
      expect.arrayContaining(['-r', '/tmp/test-temp-dir/test-source.zip', '.']),
      expect.objectContaining({ cwd: '/test/source' }),
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

    expect(mockFs.unlink).toHaveBeenCalledWith('/tmp/test-temp-dir/test-source.zip')
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
      expect.arrayContaining(['-x', 'node_modules', '.git', '.netlify', '.env']),
      expect.objectContaining({ cwd: '/test/source' }),
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
})
