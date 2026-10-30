import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchHistoricalLogs } from '../../../../src/commands/logs/log-api.js'

const fetchMock = vi.fn<typeof fetch>()
const from = 1_000_000
const to = 2_000_000
const deployId = 'test-deploy'
const accessToken = 'test-token'
const line = { ts: from, type: 'line', level: 'INFO', message: 'first page' }
const marker = { ...line, ts: from + 100, message: 'expected marker' }

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe.each(['function_logs/test-function', 'edge_function_logs'])('historical %s', (path) => {
  const baseUrl = `https://analytics.services.netlify.com/v2/sites/test-site/${path}?search=test`
  const options = { baseUrl, accessToken, from, to, deployId }

  it('follows the top-level next cursor and includes events beyond the first 100 lines', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ ...line, ts: from + index }))
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ logs: firstPage, next: 'page-2' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ logs: [marker], next: '' })))

    const entries = await fetchHistoricalLogs(options)

    expect(entries).toEqual([...firstPage, marker])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const urls = fetchMock.mock.calls.map(([input]) => new URL(input as string))
    expect(urls.map((url) => url.searchParams.get('cursor'))).toEqual([null, 'page-2'])
    for (const url of urls) {
      expect(url.searchParams.get('from')).toBe(String(from))
      expect(url.searchParams.get('to')).toBe(String(to))
      expect(url.searchParams.get('deploy_id')).toBe(deployId)
      expect(url.searchParams.get('search')).toBe('test')
    }
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.headers).toMatchObject({ Authorization: `Bearer ${accessToken}` })
    }
  })

  it.each([{ logs: [] }, { logs: [line] }])('returns a final page without a cursor: $logs', async ({ logs }) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ logs })))

    expect(await fetchHistoricalLogs(options)).toEqual(logs)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports a later page failure instead of returning incomplete logs', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ logs: [line], next: 'page-2' })))
      .mockResolvedValueOnce(new Response('', { status: 502, statusText: 'Bad Gateway' }))

    await expect(fetchHistoricalLogs(options)).rejects.toThrow('Failed to fetch logs: 502 Bad Gateway')
  })
})
