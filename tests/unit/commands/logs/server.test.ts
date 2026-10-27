import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchServerHistoricalLogs, streamServer } from '../../../../src/commands/logs/sources/server.js'
import type { LogEntry } from '../../../../src/commands/logs/log-api.js'

const API_BASE = 'https://api.example.test/api/v1'
const SITE_ID = 'site-1'
const ACCESS_TOKEN = 'token-1'
const POLL_INTERVAL_MS = 2_000
const LOOK_BACK_MS = 10_000

interface ServerLogLine {
  timestamp: number
  severity: string
  body: string
  actor_id: string
}

const line = (timestamp: number, body: string, overrides: Partial<ServerLogLine> = {}): ServerLogLine => ({
  timestamp,
  severity: 'info',
  body,
  actor_id: 'actor-1',
  ...overrides,
})

const page = (logs: ServerLogLine[], hasNextPage = false) =>
  new Response(JSON.stringify({ logs, page: 1, has_next_page: hasNextPage }), { status: 200 })

const fetchMock = vi.fn<typeof fetch>()
const requestedUrls = () => fetchMock.mock.calls.map(([input]) => new URL(input as string))

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('fetchServerHistoricalLogs', () => {
  const from = 1_000_000
  const to = 2_000_000

  it('requests the window from the site observability endpoint with the access token', async () => {
    fetchMock.mockResolvedValueOnce(page([]))

    await fetchServerHistoricalLogs({ apiBase: API_BASE, siteId: SITE_ID, accessToken: ACCESS_TOKEN, from, to })

    const [url] = requestedUrls()
    expect(url.pathname).toBe(`/api/v1/sites/${SITE_ID}/observability/server/logs`)
    expect(url.searchParams.get('from_ts')).toBe(String(from))
    expect(url.searchParams.get('to_ts')).toBe(String(to))
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: `Bearer ${ACCESS_TOKEN}` })
  })

  it('maps each line to a server entry named after its instance', async () => {
    fetchMock.mockResolvedValueOnce(page([line(from + 1, 'boom', { severity: 'error', actor_id: 'actor-9' })]))

    const { entries } = await fetchServerHistoricalLogs({
      apiBase: API_BASE,
      siteId: SITE_ID,
      accessToken: ACCESS_TOKEN,
      from,
      to,
    })

    expect(entries).toEqual<LogEntry[]>([
      { source: 'server', name: 'actor-9', ts: from + 1, level: 'ERROR', message: 'boom' },
    ])
  })

  it('follows has_next_page until the last page', async () => {
    fetchMock
      .mockResolvedValueOnce(page([line(from + 3, 'third')], true))
      .mockResolvedValueOnce(page([line(from + 2, 'second')], true))
      .mockResolvedValueOnce(page([line(from + 1, 'first')]))

    const { entries, truncated } = await fetchServerHistoricalLogs({
      apiBase: API_BASE,
      siteId: SITE_ID,
      accessToken: ACCESS_TOKEN,
      from,
      to,
    })

    expect(requestedUrls().map((url) => url.searchParams.get('page'))).toEqual(['1', '2', '3'])
    expect(entries.map((entry) => entry.message)).toEqual(['third', 'second', 'first'])
    expect(truncated).toBe(false)
  })

  it('stops paging where the API stops serving older pages, and says so', async () => {
    const maxPages = 1 + 10_000 / 500
    fetchMock.mockImplementation(() => Promise.resolve(page([line(from + 1, 'more')], true)))

    const { truncated } = await fetchServerHistoricalLogs({
      apiBase: API_BASE,
      siteId: SITE_ID,
      accessToken: ACCESS_TOKEN,
      from,
      to,
    })

    expect(fetchMock).toHaveBeenCalledTimes(maxPages)
    expect(truncated).toBe(true)
  })

  it('throws with the status when the API rejects the request', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 403, statusText: 'Forbidden' }))

    await expect(
      fetchServerHistoricalLogs({ apiBase: API_BASE, siteId: SITE_ID, accessToken: ACCESS_TOKEN, from, to }),
    ).rejects.toThrow('Failed to fetch server logs: 403 Forbidden')
  })
})

describe('streamServer', () => {
  const start = 5_000_000

  beforeEach(() => {
    vi.useFakeTimers({ now: start })
  })

  it('first polls the look-back window up to now', async () => {
    fetchMock.mockResolvedValue(page([]))

    const stop = streamServer({ apiBase: API_BASE, siteId: SITE_ID, accessToken: ACCESS_TOKEN, onEntry: vi.fn() })
    await vi.advanceTimersByTimeAsync(0)
    stop()

    const [url] = requestedUrls()
    expect(url.searchParams.get('from_ts')).toBe(String(start - LOOK_BACK_MS))
    expect(url.searchParams.get('to_ts')).toBe(String(start))
  })

  it('emits each line once, oldest first, across overlapping polls', async () => {
    fetchMock
      .mockResolvedValueOnce(page([line(start - 1, 'b'), line(start - 2, 'a')]))
      .mockResolvedValueOnce(page([line(start + 1, 'c'), line(start - 1, 'b')]))
    const onEntry = vi.fn<(entry: LogEntry) => void>()

    const stop = streamServer({ apiBase: API_BASE, siteId: SITE_ID, accessToken: ACCESS_TOKEN, onEntry })
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    stop()

    expect(onEntry.mock.calls.map(([entry]) => entry.message)).toEqual(['a', 'b', 'c'])
  })

  it('looks back from the newest line it has seen', async () => {
    const newest = start + 500
    fetchMock.mockResolvedValueOnce(page([line(newest, 'latest')])).mockResolvedValue(page([]))

    const stop = streamServer({ apiBase: API_BASE, siteId: SITE_ID, accessToken: ACCESS_TOKEN, onEntry: vi.fn() })
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    stop()

    expect(requestedUrls()[1].searchParams.get('from_ts')).toBe(String(newest - LOOK_BACK_MS))
  })

  it('emits a repeated identical line as often as the API returns it', async () => {
    fetchMock
      .mockResolvedValueOnce(page([line(start - 1, 'same')]))
      .mockResolvedValueOnce(page([line(start - 1, 'same'), line(start - 1, 'same')]))
    const onEntry = vi.fn<(entry: LogEntry) => void>()

    const stop = streamServer({ apiBase: API_BASE, siteId: SITE_ID, accessToken: ACCESS_TOKEN, onEntry })
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    stop()

    expect(onEntry).toHaveBeenCalledTimes(2)
  })

  it('reports the first of consecutive failed polls, and again after a recovery', async () => {
    const failure = () => new Response('', { status: 502, statusText: 'Bad Gateway' })
    fetchMock
      .mockResolvedValueOnce(failure())
      .mockResolvedValueOnce(failure())
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(failure())
    const onError = vi.fn<(error: Error) => void>()

    const stop = streamServer({
      apiBase: API_BASE,
      siteId: SITE_ID,
      accessToken: ACCESS_TOKEN,
      onEntry: vi.fn(),
      onError,
    })
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
    stop()

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(onError).toHaveBeenCalledTimes(2)
    expect(onError.mock.calls[0][0].message).toBe('Failed to fetch server logs: 502 Bad Gateway')
  })

  it('keeps polling after a failed request', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 502, statusText: 'Bad Gateway' }))
      .mockResolvedValueOnce(page([line(start, 'recovered')]))
    const onEntry = vi.fn<(entry: LogEntry) => void>()

    const stop = streamServer({ apiBase: API_BASE, siteId: SITE_ID, accessToken: ACCESS_TOKEN, onEntry })
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    stop()

    expect(onEntry.mock.calls.map(([entry]) => entry.message)).toEqual(['recovered'])
  })

  it.each([401, 403, 404])('stops and reports when the API answers %i', async (status) => {
    fetchMock.mockResolvedValue(new Response('', { status }))
    const onError = vi.fn<(error: Error) => void>()

    streamServer({ apiBase: API_BASE, siteId: SITE_ID, accessToken: ACCESS_TOKEN, onEntry: vi.fn(), onError })
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].message).toContain(`Failed to fetch server logs: ${String(status)}`)
  })

  it('stops polling once stopped', async () => {
    fetchMock.mockResolvedValue(page([]))

    const stop = streamServer({ apiBase: API_BASE, siteId: SITE_ID, accessToken: ACCESS_TOKEN, onEntry: vi.fn() })
    await vi.advanceTimersByTimeAsync(0)
    stop()
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
