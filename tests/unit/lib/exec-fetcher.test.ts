import { readFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import process from 'process'
import { gzipSync } from 'zlib'

import { packTar } from 'modern-tar'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi, type MockInstance } from 'vitest'

import { fetchLatestVersion, getArch, getExecName } from '../../../src/lib/exec-fetcher.js'

let processArchSpy: MockInstance<() => typeof process.arch>
let processPlatformSpy: MockInstance<() => typeof process.platform>

beforeAll(() => {
  processArchSpy = vi.spyOn(process, 'arch', 'get')
  processPlatformSpy = vi.spyOn(process, 'platform', 'get')
})

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  processArchSpy.mockReset()
  processPlatformSpy.mockReset()
})

afterAll(() => {
  vi.restoreAllMocks()
})

test(`should use 386 if process architecture is ia32`, () => {
  processArchSpy.mockReturnValue('ia32')
  expect(getArch()).toBe('386')
})

test(`should use amd64 if process architecture is x64`, () => {
  processArchSpy.mockReturnValue('x64')
  expect(getArch()).toBe('amd64')
})

test(`should append .exe on windows for the executable name`, () => {
  processPlatformSpy.mockReturnValue('win32')
  const execName = 'some-binary-file'
  expect(getExecName({ execName })).toBe(`${execName}.exe`)
})

test(`should not append anything on darwin to executable`, () => {
  processPlatformSpy.mockReturnValue('darwin')
  const execName = 'some-binary-file'
  expect(getExecName({ execName })).toBe(execName)
})

test(`should not append anything on linux to executable`, () => {
  processPlatformSpy.mockReturnValue('linux')
  const execName = 'some-binary-file'
  expect(getExecName({ execName })).toBe(execName)
})

describe('fetchLatestVersion', () => {
  test('should throw a user-friendly error on 404', async () => {
    processArchSpy.mockReturnValue('x64')
    processPlatformSpy.mockReturnValue('win32')
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      body: null,
      text: () => Promise.resolve('Not Found'),
    } as unknown as Response)

    await expect(
      fetchLatestVersion({
        packageName: 'traffic-mesh-agent',
        execName: 'traffic-mesh',
        destination: '',
        extension: 'zip',
        latestVersion: 'v1.0.0',
      }),
    ).rejects.toThrowError(/The operating system windows with the CPU architecture amd64 is currently not supported!/)
  })

  test('should propagate non-404 errors', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      body: null,
      text: () => Promise.resolve('Internal Server Error'),
    } as unknown as Response)

    await expect(
      fetchLatestVersion({
        packageName: 'traffic-mesh-agent',
        execName: 'traffic-mesh',
        destination: '',
        extension: 'zip',
        latestVersion: 'v1.0.0',
      }),
    ).rejects.toThrowError(/Download failed: 500/)
  })

  test('should map linux x64 to amd64 arch', async () => {
    processArchSpy.mockReturnValue('x64')
    processPlatformSpy.mockReturnValue('linux')
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      body: null,
      text: () => Promise.resolve('Not Found'),
    } as unknown as Response)

    await expect(
      fetchLatestVersion({
        packageName: 'traffic-mesh-agent',
        execName: 'traffic-mesh',
        destination: '',
        extension: 'zip',
        latestVersion: 'v1.0.0',
      }),
    ).rejects.toThrowError(/The operating system linux with the CPU architecture amd64 is currently not supported!/)
  })

  test('should resolve latest tag from GitHub API when latestVersion is not provided', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tag_name: 'v2.0.0' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        body: null,
        text: () => Promise.resolve('Not Found'),
      } as unknown as Response)

    await expect(
      fetchLatestVersion({
        packageName: 'traffic-mesh-agent',
        execName: 'traffic-mesh',
        destination: '',
        extension: 'tar.gz',
      }),
    ).rejects.toThrowError()

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://api.github.com/repos/netlify/traffic-mesh-agent/releases/latest',
      expect.objectContaining({ headers: expect.any(Object) as unknown }),
    )
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/releases/download/v2.0.0/'),
      expect.any(Object) as unknown,
    )
  })

  test('should throw on GitHub API rate limit', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve('{"message":"API rate limit exceeded for ..."}'),
    } as unknown as Response)

    await expect(
      fetchLatestVersion({
        packageName: 'traffic-mesh-agent',
        execName: 'traffic-mesh',
        destination: '',
        extension: 'tar.gz',
      }),
    ).rejects.toThrowError(/GitHub API rate limit exceeded/)
  })

  test('should download and extract a tar.gz release', async () => {
    const destination = path.join(os.tmpdir(), `exec-fetcher-test-${String(Date.now())}`)
    const fileContent = 'hello from test binary'

    const tarBuffer = await packTar([{ header: { name: 'test-binary', size: fileContent.length }, body: fileContent }])
    const gzipped = gzipSync(Buffer.from(tarBuffer))

    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(gzipped)
        controller.close()
      },
    })
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      body,
    } as unknown as Response)

    await fetchLatestVersion({
      packageName: 'traffic-mesh-agent',
      execName: 'traffic-mesh',
      destination,
      extension: 'tar.gz',
      latestVersion: 'v1.0.0',
    })

    const extracted = await readFile(path.join(destination, 'test-binary'), 'utf-8')
    expect(extracted).toBe(fileContent)
  })

  test('should include auth header when NETLIFY_TEST_GITHUB_TOKEN is set', async () => {
    const originalToken: string | undefined = process.env.NETLIFY_TEST_GITHUB_TOKEN
    process.env.NETLIFY_TEST_GITHUB_TOKEN = 'test-token-123'

    try {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        body: null,
        text: () => Promise.resolve('error'),
      } as unknown as Response)

      await expect(
        fetchLatestVersion({
          packageName: 'traffic-mesh-agent',
          execName: 'traffic-mesh',
          destination: '',
          extension: 'tar.gz',
          latestVersion: 'v1.0.0',
        }),
      ).rejects.toThrowError()

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'token test-token-123' }) as unknown,
        }),
      )
    } finally {
      if (originalToken === undefined) {
        delete process.env.NETLIFY_TEST_GITHUB_TOKEN
      } else {
        process.env.NETLIFY_TEST_GITHUB_TOKEN = originalToken
      }
    }
  })
})
