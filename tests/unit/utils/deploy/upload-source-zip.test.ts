import { describe, expect, test, vi } from 'vitest'

import { uploadSourceZip } from '../../../../src/utils/deploy/upload-source-zip.js'

type ExecCallback = (error: Error | null, result: { stdout: string; stderr: string }) => void

vi.mock('node-fetch')
vi.mock('child_process')
vi.mock('fs/promises')
vi.mock('../../../../src/utils/command-helpers.js')
vi.mock('../../../../src/utils/temporary-file.js')

describe('uploadSourceZip', () => {
  test('creates zip and uploads successfully', async () => {
    const mockExecFile = vi.fn((_command, _args, _options, callback: ExecCallback) => {
      callback(null, { stdout: '', stderr: '' })
    })
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    })

    const mockReadFile = vi.fn().mockResolvedValue(Buffer.from('mock zip content'))
    const mockStat = vi.fn().mockResolvedValue({ size: 1024 })
    const mockUnlink = vi.fn().mockResolvedValue(undefined)
    const mockLog = vi.fn()
    const mockTemporaryDirectory = vi.fn().mockReturnValue('/tmp/test-temp-dir')

    vi.doMock('node-fetch', () => ({ default: mockFetch }))
    vi.doMock('child_process', () => ({ execFile: mockExecFile }))
    vi.doMock('fs/promises', () => ({ 
      readFile: mockReadFile, 
      stat: mockStat, 
      unlink: mockUnlink 
    }))
    vi.doMock('../../../../src/utils/command-helpers.js', () => ({ log: mockLog }))
    vi.doMock('../../../../src/utils/temporary-file.js', () => ({ 
      temporaryDirectory: mockTemporaryDirectory 
    }))

    const mockStatusCb = vi.fn()
    
    await uploadSourceZip({
      sourceDir: '/test/source',
      uploadUrl: 'https://s3.example.com/upload-url',
      filename: 'test-source.zip',
      statusCb: mockStatusCb,
    })
    
    expect(mockExecFile).toHaveBeenCalledWith(
      'zip',
      expect.arrayContaining(['-r', '/tmp/test-temp-dir/source.zip', '.']),
      expect.objectContaining({ cwd: '/test/source' }),
      expect.any(Function),
    )
    
    expect(mockFetch).toHaveBeenCalledWith(
      'https://s3.example.com/upload-url',
      expect.objectContaining({
        method: 'PUT',
        body: Buffer.from('mock zip content'),
        headers: expect.objectContaining({
          'Content-Type': 'application/zip',
          'Content-Length': '16',
        }) as Record<string, string>,
      }),
    )
    
    expect(mockStatusCb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'source-zip-upload',
        msg: 'Creating source code zip...',
        phase: 'start',
      }),
    )
    
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/test-temp-dir/source.zip')
    expect(mockLog).toHaveBeenCalledWith('Source code uploaded to enable Netlify Agent Runners')
  })

  test('handles upload failure correctly', async () => {
    const mockExecFile = vi.fn((_command, _args, _options, callback: ExecCallback) => {
      callback(null, { stdout: '', stderr: '' })
    })
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    })

    const mockReadFile = vi.fn().mockResolvedValue(Buffer.from('mock zip content'))
    const mockStat = vi.fn().mockResolvedValue({ size: 1024 })
    const mockUnlink = vi.fn().mockResolvedValue(undefined)
    const mockWarn = vi.fn()
    const mockTemporaryDirectory = vi.fn().mockReturnValue('/tmp/test-temp-dir')

    vi.doMock('node-fetch', () => ({ default: mockFetch }))
    vi.doMock('child_process', () => ({ execFile: mockExecFile }))
    vi.doMock('fs/promises', () => ({ 
      readFile: mockReadFile, 
      stat: mockStat, 
      unlink: mockUnlink 
    }))
    vi.doMock('../../../../src/utils/command-helpers.js', () => ({ warn: mockWarn }))
    vi.doMock('../../../../src/utils/temporary-file.js', () => ({ 
      temporaryDirectory: mockTemporaryDirectory 
    }))

    const mockStatusCb = vi.fn()
    
    await expect(
      uploadSourceZip({
        sourceDir: '/test/source',
        uploadUrl: 'https://s3.example.com/upload-url',
        filename: 'test-source.zip',
        statusCb: mockStatusCb,
      }),
    ).rejects.toThrow('Failed to upload zip: 403 Forbidden')
    
    expect(mockStatusCb).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'source-zip-upload',
        phase: 'error',
        msg: expect.stringContaining('Failed to upload source zip') as string,
      }),
    )
    
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('Failed to upload source zip'))
  })

  test('includes proper exclusion patterns in zip command', async () => {
    const mockExecFile = vi.fn((_command, _args, _options, callback: ExecCallback) => {
      callback(null, { stdout: '', stderr: '' })
    })
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    })

    const mockReadFile = vi.fn().mockResolvedValue(Buffer.from('mock zip content'))
    const mockStat = vi.fn().mockResolvedValue({ size: 1024 })
    const mockUnlink = vi.fn().mockResolvedValue(undefined)
    const mockLog = vi.fn()
    const mockTemporaryDirectory = vi.fn().mockReturnValue('/tmp/test-temp-dir')

    vi.doMock('node-fetch', () => ({ default: mockFetch }))
    vi.doMock('child_process', () => ({ execFile: mockExecFile }))
    vi.doMock('fs/promises', () => ({ 
      readFile: mockReadFile, 
      stat: mockStat, 
      unlink: mockUnlink 
    }))
    vi.doMock('../../../../src/utils/command-helpers.js', () => ({ log: mockLog }))
    vi.doMock('../../../../src/utils/temporary-file.js', () => ({ 
      temporaryDirectory: mockTemporaryDirectory 
    }))

    const mockStatusCb = vi.fn()
    
    await uploadSourceZip({
      sourceDir: '/test/source',
      uploadUrl: 'https://s3.example.com/upload-url',
      filename: 'test-source.zip',
      statusCb: mockStatusCb,
    })
    
    expect(mockExecFile).toHaveBeenCalledWith(
      'zip',
      expect.arrayContaining(['-x', 'node_modules', '.git', '.netlify', '.env']),
      expect.objectContaining({ cwd: '/test/source' }),
      expect.any(Function),
    )
  })
})