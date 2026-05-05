import { readFile, rm } from 'fs/promises'
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
  vi.unstubAllEnvs()
  processArchSpy.mockReset()
  processPlatformSpy.mockReset()
})

afterAll(() => {
  vi.restoreAllMocks()
})

const FETCH_ARGS = {
  packageName: 'traffic-mesh-agent',
  execName: 'traffic-mesh',
  destination: '',
  extension: 'tar.gz',
  latestVersion: 'v1.0.0',
} as const

test('getArch maps ia32 to 386', () => {
  processArchSpy.mockReturnValue('ia32')
  expect(getArch()).toBe('386')
})

test('getArch maps x64 to amd64', () => {
  processArchSpy.mockReturnValue('x64')
  expect(getArch()).toBe('amd64')
})

test('getExecName appends .exe on Windows', () => {
  processPlatformSpy.mockReturnValue('win32')
  expect(getExecName({ execName: 'some-binary' })).toBe('some-binary.exe')
})

test('getExecName leaves the name unchanged on macOS', () => {
  processPlatformSpy.mockReturnValue('darwin')
  expect(getExecName({ execName: 'some-binary' })).toBe('some-binary')
})

test('getExecName leaves the name unchanged on Linux', () => {
  processPlatformSpy.mockReturnValue('linux')
  expect(getExecName({ execName: 'some-binary' })).toBe('some-binary')
})

describe('fetchLatestVersion', () => {
  test('throws a user-friendly error on 404 mentioning OS and arch', async () => {
    processArchSpy.mockReturnValue('x64')
    processPlatformSpy.mockReturnValue('win32')
    vi.mocked(fetch).mockResolvedValue(new Response('Not Found', { status: 404 }))

    await expect(fetchLatestVersion({ ...FETCH_ARGS, extension: 'zip' })).rejects.toThrowError(
      /The operating system windows with the CPU architecture amd64 is currently not supported!/,
    )
  })

  test('throws the HTTP status on non-404 download errors', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Internal Server Error', { status: 500 }))

    await expect(fetchLatestVersion(FETCH_ARGS)).rejects.toThrowError(/Download failed: 500/)
  })

  test('includes the platform and arch in the 404 error for linux-x64', async () => {
    processArchSpy.mockReturnValue('x64')
    processPlatformSpy.mockReturnValue('linux')
    vi.mocked(fetch).mockResolvedValue(new Response('Not Found', { status: 404 }))

    await expect(fetchLatestVersion(FETCH_ARGS)).rejects.toThrowError(
      /The operating system linux with the CPU architecture amd64 is currently not supported!/,
    )
  })

  test('resolves the latest tag from GitHub when latestVersion is omitted', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ tag_name: 'v2.0.0' })))
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))

    await expect(fetchLatestVersion({ ...FETCH_ARGS, latestVersion: undefined })).rejects.toThrowError()

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://api.github.com/repos/netlify/traffic-mesh-agent/releases/latest',
      expect.objectContaining({ headers: expect.any(Object) as unknown }),
    )
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/releases/download/v2.0.0/'),
      expect.any(Object) as unknown,
    )
  })

  test('throws when the GitHub releases API returns an error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 403 }))

    await expect(fetchLatestVersion({ ...FETCH_ARGS, latestVersion: undefined })).rejects.toThrowError(
      /Failed to fetch latest release.*403/,
    )
  })

  test('downloads and extracts a tar.gz release to the destination', async () => {
    const destination = path.join(os.tmpdir(), `exec-fetcher-test-${String(Date.now())}`)
    const fileContent = 'hello from test binary'

    try {
      const tarBuffer = await packTar([
        { header: { name: 'test-binary', size: fileContent.length }, body: fileContent },
      ])
      const gzipped = gzipSync(Buffer.from(tarBuffer))

      vi.mocked(fetch).mockResolvedValue(new Response(gzipped))

      await fetchLatestVersion({ ...FETCH_ARGS, destination })

      const extracted = await readFile(path.join(destination, 'test-binary'), 'utf-8')
      expect(extracted).toBe(fileContent)
    } finally {
      await rm(destination, { recursive: true, force: true })
    }
  })

  test('sends an Authorization header when NETLIFY_TEST_GITHUB_TOKEN is set', async () => {
    vi.stubEnv('NETLIFY_TEST_GITHUB_TOKEN', 'test-token-123')

    vi.mocked(fetch).mockResolvedValue(new Response('error', { status: 500 }))

    await expect(fetchLatestVersion(FETCH_ARGS)).rejects.toThrowError()

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'token test-token-123' }) as unknown,
      }),
    )
  })
})
