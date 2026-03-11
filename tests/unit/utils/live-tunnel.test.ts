import { EventEmitter } from 'events'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { startLiveTunnel, getLiveTunnelSlug } from '../../../src/utils/live-tunnel.js'

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}))

vi.mock('../../../src/lib/exec-fetcher.js', () => ({
  shouldFetchLatestVersion: vi.fn().mockResolvedValue(false),
  fetchLatestVersion: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../src/lib/settings.js', () => ({
  getPathInHome: vi.fn((...args: string[][]) => `/mock/home/${args.flat().join('/')}`),
}))

const createMockProcess = () => {
  const ps = new EventEmitter()
  return ps
}

vi.mock('../../../src/utils/execa.js', () => ({
  default: vi.fn(() => createMockProcess()),
}))

vi.mock('../../../src/utils/command-helpers.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils/command-helpers.js')>(
    '../../../src/utils/command-helpers.js',
  )
  return {
    ...actual,
    exit: vi.fn((code?: number) => {
      throw new Error(`process.exit(${String(code)})`)
    }),
    log: vi.fn(),
  }
})

vi.mock('p-wait-for', () => ({
  default: vi.fn(async (fn: () => Promise<boolean>) => {
    let ready = false
    while (!ready) {
      ready = await fn()
    }
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('startLiveTunnel', () => {
  test('should create a live tunnel session and return the session URL', async () => {
    const { default: fetch } = await import('node-fetch')

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        status: 201,
        json: () =>
          Promise.resolve({
            id: 'session-123',
            session_url: 'https://test--my-site.netlify.live',
            state: 'connecting',
          }),
      } as never)
      .mockResolvedValueOnce({
        status: 200,
        json: () =>
          Promise.resolve({ id: 'session-123', session_url: 'https://test--my-site.netlify.live', state: 'online' }),
      } as never)

    const result = await startLiveTunnel({
      siteId: 'site-456',
      netlifyApiToken: 'fake-token',
      localPort: 8888,
      slug: 'test',
    })

    expect(result).toBe('https://test--my-site.netlify.live')

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://api.netlify.com/api/v1/live_sessions?site_id=site-456&slug=test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer fake-token',
        }) as unknown,
      }),
    )
  })

  test('should poll until the session is online', async () => {
    const { default: fetch } = await import('node-fetch')

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        status: 201,
        json: () =>
          Promise.resolve({ id: 'session-123', session_url: 'https://test.netlify.live', state: 'connecting' }),
      } as never)
      .mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ id: 'session-123', state: 'booting' }),
      } as never)
      .mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ id: 'session-123', state: 'online' }),
      } as never)

    await startLiveTunnel({
      siteId: 'site-456',
      netlifyApiToken: 'fake-token',
      localPort: 8888,
      slug: 'test',
    })

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3)
  })

  test('should spawn the tunnel client binary with correct args', async () => {
    const { default: fetch } = await import('node-fetch')
    const { default: execa } = await import('../../../src/utils/execa.js')

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        status: 201,
        json: () =>
          Promise.resolve({ id: 'session-abc', session_url: 'https://test.netlify.live', state: 'connecting' }),
      } as never)
      .mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ id: 'session-abc', state: 'online' }),
      } as never)

    await startLiveTunnel({
      siteId: 'site-456',
      netlifyApiToken: 'fake-token',
      localPort: 3000,
      slug: 'test',
    })

    expect(vi.mocked(execa)).toHaveBeenCalledWith(
      '/mock/home/tunnel/bin/live-tunnel-client',
      ['connect', '-s', 'session-abc', '-t', 'fake-token', '-l', '3000'],
      { stdio: 'inherit' },
    )
  })

  test('should install the tunnel client if shouldFetchLatestVersion returns true', async () => {
    const { default: fetch } = await import('node-fetch')
    const { shouldFetchLatestVersion, fetchLatestVersion } = await import('../../../src/lib/exec-fetcher.js')

    vi.mocked(shouldFetchLatestVersion).mockResolvedValueOnce(true)

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        status: 201,
        json: () =>
          Promise.resolve({ id: 'session-123', session_url: 'https://test.netlify.live', state: 'connecting' }),
      } as never)
      .mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ id: 'session-123', state: 'online' }),
      } as never)

    await startLiveTunnel({
      siteId: 'site-456',
      netlifyApiToken: 'fake-token',
      localPort: 8888,
      slug: 'test',
    })

    expect(vi.mocked(fetchLatestVersion)).toHaveBeenCalledWith(
      expect.objectContaining({
        packageName: 'live-tunnel-client',
        execName: 'live-tunnel-client',
      }),
    )
  })

  test('should not install the tunnel client if shouldFetchLatestVersion returns false', async () => {
    const { default: fetch } = await import('node-fetch')
    const { fetchLatestVersion } = await import('../../../src/lib/exec-fetcher.js')

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        status: 201,
        json: () =>
          Promise.resolve({ id: 'session-123', session_url: 'https://test.netlify.live', state: 'connecting' }),
      } as never)
      .mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ id: 'session-123', state: 'online' }),
      } as never)

    await startLiveTunnel({
      siteId: 'site-456',
      netlifyApiToken: 'fake-token',
      localPort: 8888,
      slug: 'test',
    })

    expect(vi.mocked(fetchLatestVersion)).not.toHaveBeenCalled()
  })

  test('should exit with error if siteId is missing', async () => {
    await expect(
      startLiveTunnel({
        siteId: undefined,
        netlifyApiToken: 'fake-token',
        localPort: 8888,
        slug: 'test',
      }),
    ).rejects.toThrowError('process.exit(1)')
  })

  test('should exit with error if netlifyApiToken is missing', async () => {
    await expect(
      startLiveTunnel({
        siteId: 'site-456',
        netlifyApiToken: null,
        localPort: 8888,
        slug: 'test',
      }),
    ).rejects.toThrowError('process.exit(1)')
  })

  test('should throw if session creation fails', async () => {
    const { default: fetch } = await import('node-fetch')

    vi.mocked(fetch).mockResolvedValueOnce({
      status: 422,
      json: () => Promise.resolve({ message: 'Slug already taken' }),
    } as never)

    await expect(
      startLiveTunnel({
        siteId: 'site-456',
        netlifyApiToken: 'fake-token',
        localPort: 8888,
        slug: 'taken-slug',
      }),
    ).rejects.toThrowError('Slug already taken')
  })

  test('should throw if polling returns a non-200 status', async () => {
    const { default: fetch } = await import('node-fetch')

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        status: 201,
        json: () =>
          Promise.resolve({ id: 'session-123', session_url: 'https://test.netlify.live', state: 'connecting' }),
      } as never)
      .mockResolvedValueOnce({
        status: 500,
        json: () => Promise.resolve({ message: 'Internal server error' }),
      } as never)

    await expect(
      startLiveTunnel({
        siteId: 'site-456',
        netlifyApiToken: 'fake-token',
        localPort: 8888,
        slug: 'test',
      }),
    ).rejects.toThrowError('Internal server error')
  })
})

describe('getLiveTunnelSlug', () => {
  test('should return override if provided', () => {
    const getMock = vi.fn()
    const state = { get: getMock, set: vi.fn() } as unknown as Parameters<typeof getLiveTunnelSlug>[0]
    expect(getLiveTunnelSlug(state, 'custom-slug')).toBe('custom-slug')
    expect(getMock).not.toHaveBeenCalled()
  })

  test('should return existing slug from state', () => {
    const state = {
      get: vi.fn().mockReturnValue('existing-slug'),
      set: vi.fn(),
    } as unknown as Parameters<typeof getLiveTunnelSlug>[0]

    expect(getLiveTunnelSlug(state, undefined)).toBe('existing-slug')
  })

  test('should generate and persist a new slug if none exists', () => {
    const setMock = vi.fn()
    const state = {
      get: vi.fn().mockReturnValue(undefined),
      set: setMock,
    } as unknown as Parameters<typeof getLiveTunnelSlug>[0]

    const slug = getLiveTunnelSlug(state, undefined)
    expect(slug).toMatch(/^[\da-f]{8}$/)
    expect(setMock).toHaveBeenCalledWith('liveTunnelSlug', slug)
  })
})
