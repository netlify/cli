import { EventEmitter } from 'events'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { startLiveTunnel, getLiveTunnelSlug } from '../../../src/utils/live-tunnel.js'
import type { LocalState } from '../../../src/utils/types.js'

vi.mock('../../../src/lib/exec-fetcher.js', () => ({
  shouldFetchLatestVersion: vi.fn().mockResolvedValue(false),
  fetchLatestVersion: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../src/lib/settings.js', () => ({
  getPathInHome: vi.fn((...args: string[][]) => `/mock/home/${args.flat().join('/')}`),
}))

vi.mock('../../../src/utils/execa.js', () => ({
  default: vi.fn(() => new EventEmitter()),
}))

vi.mock('../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual<typeof import('../../../src/utils/command-helpers.js')>(
    '../../../src/utils/command-helpers.js',
  )),
  exit: vi.fn((code?: number) => {
    throw new Error(`process.exit(${String(code)})`)
  }),
  log: vi.fn(),
}))

vi.mock('p-wait-for', () => ({
  default: vi.fn(async (fn: () => Promise<boolean>) => {
    let ready = false
    while (!ready) {
      ready = await fn()
    }
  }),
}))

const mockFetchResponse = (status: number, body: Record<string, unknown>) =>
  ({ status, json: () => Promise.resolve(body) } as never)

const TUNNEL_ARGS = {
  siteId: 'site-456',
  netlifyApiToken: 'fake-token',
  localPort: 8888,
  slug: 'test',
} as const

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('startLiveTunnel', () => {
  const mockSessionCreatedThenOnline = (sessionId = 'session-123', sessionUrl = 'https://test.netlify.live') => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockFetchResponse(201, { id: sessionId, session_url: sessionUrl, state: 'connecting' }))
      .mockResolvedValueOnce(mockFetchResponse(200, { id: sessionId, state: 'online' }))
  }

  test('returns the session URL', async () => {
    mockSessionCreatedThenOnline('session-123', 'https://test--my-site.netlify.live')

    const result = await startLiveTunnel(TUNNEL_ARGS)

    expect(result).toBe('https://test--my-site.netlify.live')
  })

  test('creates a session via the Netlify API with auth', async () => {
    mockSessionCreatedThenOnline()

    await startLiveTunnel(TUNNEL_ARGS)

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://api.netlify.com/api/v1/live_sessions?site_id=site-456&slug=test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer fake-token' }) as unknown,
      }),
    )
  })

  test('polls the session until it is online', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        mockFetchResponse(201, { id: 'session-123', session_url: 'https://test.netlify.live', state: 'connecting' }),
      )
      .mockResolvedValueOnce(mockFetchResponse(200, { id: 'session-123', state: 'booting' }))
      .mockResolvedValueOnce(mockFetchResponse(200, { id: 'session-123', state: 'online' }))

    await startLiveTunnel(TUNNEL_ARGS)

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3)
  })

  test('spawns the tunnel client binary with the session ID and port', async () => {
    const { default: execa } = await import('../../../src/utils/execa.js')
    mockSessionCreatedThenOnline('session-abc')

    await startLiveTunnel({ ...TUNNEL_ARGS, localPort: 3000 })

    expect(vi.mocked(execa)).toHaveBeenCalledWith(
      '/mock/home/tunnel/bin/live-tunnel-client',
      ['connect', '-s', 'session-abc', '-t', 'fake-token', '-l', '3000'],
      { stdio: 'inherit' },
    )
  })

  test('installs the tunnel client when a new version is available', async () => {
    const { shouldFetchLatestVersion, fetchLatestVersion } = await import('../../../src/lib/exec-fetcher.js')
    vi.mocked(shouldFetchLatestVersion).mockResolvedValueOnce(true)
    mockSessionCreatedThenOnline()

    await startLiveTunnel(TUNNEL_ARGS)

    expect(vi.mocked(fetchLatestVersion)).toHaveBeenCalledWith(
      expect.objectContaining({ packageName: 'live-tunnel-client', execName: 'live-tunnel-client' }),
    )
  })

  test('skips installing the tunnel client when already up to date', async () => {
    const { fetchLatestVersion } = await import('../../../src/lib/exec-fetcher.js')
    mockSessionCreatedThenOnline()

    await startLiveTunnel(TUNNEL_ARGS)

    expect(vi.mocked(fetchLatestVersion)).not.toHaveBeenCalled()
  })

  test('exits when siteId is missing', async () => {
    await expect(startLiveTunnel({ ...TUNNEL_ARGS, siteId: undefined })).rejects.toThrowError('process.exit(1)')
  })

  test('exits when netlifyApiToken is missing', async () => {
    await expect(startLiveTunnel({ ...TUNNEL_ARGS, netlifyApiToken: null })).rejects.toThrowError('process.exit(1)')
  })

  test('throws the API error message when session creation fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(422, { message: 'Slug already taken' }))

    await expect(startLiveTunnel({ ...TUNNEL_ARGS, slug: 'taken-slug' })).rejects.toThrowError('Slug already taken')
  })

  test('throws the API error message when polling fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        mockFetchResponse(201, { id: 'session-123', session_url: 'https://test.netlify.live', state: 'connecting' }),
      )
      .mockResolvedValueOnce(mockFetchResponse(500, { message: 'Internal server error' }))

    await expect(startLiveTunnel(TUNNEL_ARGS)).rejects.toThrowError('Internal server error')
  })
})

describe('getLiveTunnelSlug', () => {
  const createMockState = (slug?: string) => {
    const state = { get: vi.fn().mockReturnValue(slug), set: vi.fn() }
    return state as typeof state & LocalState
  }

  test('uses the override slug without reading state', () => {
    const state = createMockState()
    expect(getLiveTunnelSlug(state, 'custom-slug')).toBe('custom-slug')
    expect(state.get).not.toHaveBeenCalled()
  })

  test('returns the existing slug from state', () => {
    const state = createMockState('existing-slug')
    expect(getLiveTunnelSlug(state, undefined)).toBe('existing-slug')
  })

  test('generates a hex slug and persists it when none exists', () => {
    const state = createMockState(undefined)
    const slug = getLiveTunnelSlug(state, undefined)
    expect(slug).toMatch(/^[\da-f]{8}$/)
    expect(state.set).toHaveBeenCalledWith('liveTunnelSlug', slug)
  })
})
