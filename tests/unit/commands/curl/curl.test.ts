import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import process from 'process'
import { pathToFileURL } from 'url'

import { NetlifyAPI } from '@netlify/api'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  formatCookieJar,
  getAccessTokens,
  getTargetHosts,
  mintAccessToken,
  runCurl,
} from '../../../../src/commands/curl/curl.js'

describe('getTargetHosts', () => {
  test('returns the hosts of http and https URLs, once each', () => {
    expect(
      getTargetHosts([
        '-H',
        'Accept: text/html',
        'https://mysitename.netlify.app/a',
        'http://mysitename.netlify.app/b',
        '--url=https://www.example.com/',
        'HTTPS://Deploy-Preview-1--mysitename.netlify.app',
      ]),
    ).toEqual(['mysitename.netlify.app', 'www.example.com', 'deploy-preview-1--mysitename.netlify.app'])
  })

  test('skips arguments that are not http or https URLs', () => {
    expect(getTargetHosts(['-d', '{"a":1}', 'mysitename.netlify.app', 'ftp://example.com/', 'https://'])).toEqual([])
  })

  test('skips IP addresses and single-label hosts', () => {
    expect(
      getTargetHosts(['http://localhost:8888/', 'http://127.0.0.1/', 'http://[::1]:3000/', 'https://intranet/']),
    ).toEqual([])
  })
})

test('formatCookieJar writes one secure, exact-host cookie per host', () => {
  expect(
    formatCookieJar(
      new Map([
        ['mysitename.netlify.app', 'token-a'],
        ['b.example.com', 'token-b'],
      ]),
    ),
  ).toBe(
    'mysitename.netlify.app\tFALSE\t/\tTRUE\t0\tnf_edge\ttoken-a\nb.example.com\tFALSE\t/\tTRUE\t0\tnf_edge\ttoken-b\n',
  )
})

describe('mintAccessToken', () => {
  const api = new NetlifyAPI('user-token', { scheme: 'https', host: 'api.example.test' })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('requests a token for the host and returns it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ edge_access: 'jwt' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(mintAccessToken(api, 'mysitename.netlify.app')).resolves.toEqual({ token: 'jwt' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.test/auth/edge-access')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer user-token' })
    expect(JSON.parse(init.body as string)).toEqual({
      site_id: 'mysitename.netlify.app',
      domain: 'mysitename.netlify.app',
    })
  })

  test('returns null when the host is not a project the user can access', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))

    await expect(mintAccessToken(api, 'www.example.com')).resolves.toBeNull()
  })

  test("returns the API's message and a way to log in again on HTTP 401", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ code: 401, message: 'Access Denied' }, { status: 401 })),
    )

    const result = await mintAccessToken(api, 'mysitename.netlify.app')

    expect(result).toHaveProperty(
      'warning',
      expect.stringContaining('Netlify did not grant access to mysitename.netlify.app: Access Denied. To log in again'),
    )
    expect(result).toHaveProperty('warning', expect.stringContaining('netlify login --new'))
  })

  test('returns the status code on HTTP 401 without a message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))

    await expect(mintAccessToken(api, 'mysitename.netlify.app')).resolves.toHaveProperty(
      'warning',
      expect.stringContaining('mysitename.netlify.app: HTTP 401. To log in again'),
    )
  })

  test('returns a warning when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND')))

    await expect(mintAccessToken(api, 'mysitename.netlify.app')).resolves.toEqual({
      warning: 'Could not request access to mysitename.netlify.app: getaddrinfo ENOTFOUND',
    })
  })

  test('returns a warning when the response has no token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ edge_access: null })))

    await expect(mintAccessToken(api, 'mysitename.netlify.app')).resolves.toHaveProperty('warning')
  })
})

describe('getAccessTokens', () => {
  const api = new NetlifyAPI('user-token', { scheme: 'https', host: 'api.example.test' })
  const createJWT = (exp: number) =>
    ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ exp })).toString('base64url'), 'signature'].join('.')
  let directory: string
  let cachePath: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'curl-tokens-test-'))
    cachePath = join(directory, 'access-tokens')
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await rm(directory, { recursive: true, force: true })
  })

  test('reuses tokens from an earlier run until shortly before they expire', async () => {
    const now = Math.floor(Date.now() / 1000)
    const fresh = createJWT(now + 3600)
    const ending = createJWT(now + 60)
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      const { site_id: host } = JSON.parse(init.body as string) as { site_id: string }
      if (host === 'other.example.com') {
        return Promise.resolve(new Response(null, { status: 404 }))
      }
      return Promise.resolve(Response.json({ edge_access: host === 'fresh--mysitename.netlify.app' ? fresh : ending }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const hosts = ['fresh--mysitename.netlify.app', 'ending--mysitename.netlify.app', 'other.example.com']

    const first = await getAccessTokens(api, hosts, cachePath)
    expect(first.tokens).toEqual(
      new Map([
        ['fresh--mysitename.netlify.app', fresh],
        ['ending--mysitename.netlify.app', ending],
      ]),
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)

    fetchMock.mockClear()
    const second = await getAccessTokens(api, hosts, cachePath)
    expect(second.tokens).toEqual(first.tokens)
    expect(
      fetchMock.mock.calls.map(([, init]) => (JSON.parse(init.body as string) as { site_id: string }).site_id),
    ).toEqual(['ending--mysitename.netlify.app', 'other.example.com'])
  })

  test('does not reuse tokens requested with a different API token', async () => {
    const token = createJWT(Math.floor(Date.now() / 1000) + 3600)
    const fetchMock = vi.fn(() => Promise.resolve(Response.json({ edge_access: token })))
    vi.stubGlobal('fetch', fetchMock)

    await getAccessTokens(api, ['mysitename.netlify.app'], cachePath)
    await getAccessTokens(
      new NetlifyAPI('other-user-token', { scheme: 'https', host: 'api.example.test' }),
      ['mysitename.netlify.app'],
      cachePath,
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('returns warnings and caches nothing for hosts that failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

    const { tokens, warnings } = await getAccessTokens(api, ['mysitename.netlify.app'], cachePath)

    expect(tokens).toEqual(new Map())
    expect(warnings).toEqual(['Could not request access to mysitename.netlify.app (HTTP 500).'])
    await expect(readdir(directory)).resolves.toEqual([])
  })
})

describe('runCurl', () => {
  let directory: string | undefined

  afterEach(async () => {
    if (directory) {
      await rm(directory, { recursive: true, force: true })
    }
  })

  // curl saves the cookies it loaded to the `--cookie-jar` file, so this checks the jar without a server.
  const runCurlAndReadCookies = async () => {
    directory = await mkdtemp(join(tmpdir(), 'curl-command-test-'))
    const target = join(directory, 'target.txt')
    const cookiesOut = join(directory, 'cookies-out.txt')
    await writeFile(target, '')

    const exitCode = await runCurl(
      ['--silent', '--output', join(directory, 'body.txt'), '--cookie-jar', cookiesOut, pathToFileURL(target).href],
      formatCookieJar(new Map([['mysitename.netlify.app', 'jwt']])),
    )

    expect(exitCode).toBe(0)
    return readFile(cookiesOut, 'utf8')
  }

  const listJarDirectories = async () =>
    (await readdir(tmpdir())).filter((name) => name.startsWith('netlify-curl-')).sort()

  test('passes the cookie jar to curl', async () => {
    expect(await runCurlAndReadCookies()).toContain('mysitename.netlify.app\tFALSE\t/\tTRUE\t0\tnf_edge\tjwt')
  })

  test('passes the cookie jar to curl in a temporary file on Windows, and deletes it', async () => {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')
    const jarDirectoriesBefore = await listJarDirectories()
    Object.defineProperty(process, 'platform', { value: 'win32' })

    try {
      expect(await runCurlAndReadCookies()).toContain('mysitename.netlify.app\tFALSE\t/\tTRUE\t0\tnf_edge\tjwt')
    } finally {
      if (platform) {
        Object.defineProperty(process, 'platform', platform)
      }
    }

    expect(await listJarDirectories()).toEqual(jarDirectoriesBefore)
  })

  test("resolves with curl's exit code", async () => {
    // curl exits with 2 for an unknown option.
    await expect(runCurl(['--silent', '--not-a-curl-option'])).resolves.toBe(2)
  })
})
