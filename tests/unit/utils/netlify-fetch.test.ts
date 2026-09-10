import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { netlifyFetch, netlifyFetchForOrigin } from '../../../src/utils/netlify-fetch.js'
import { USER_AGENT } from '../../../src/utils/user-agent.js'

const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response()))

const sentHeaders = (callIndex: number) => new Headers(fetchMock.mock.calls[callIndex][1]?.headers)

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('NETLIFY_AGENT', 'claude')
})

afterEach(() => {
  fetchMock.mockClear()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

test("sets the agent User-Agent and keeps the caller's other headers", async () => {
  await netlifyFetch('https://api.netlify.com/api/v1/sites', {
    headers: { Authorization: 'Bearer token', 'user-agent': 'caller' },
  })

  expect(sentHeaders(0).get('User-Agent')).toBe(`${USER_AGENT} agent/claude`)
  expect(sentHeaders(0).get('Authorization')).toBe('Bearer token')
})

test('adds the User-Agent only to requests for the given origin', async () => {
  const fetchForApi = netlifyFetchForOrigin('https://api.netlify.com')
  const presignedUrl = 'https://bucket.s3.amazonaws.com/blob?X-Amz-Signature=abc'

  await fetchForApi('https://api.netlify.com/api/v1/blobs/site-id/store')
  await fetchForApi(presignedUrl, { headers: { 'x-custom': '1' } })

  expect(sentHeaders(0).get('User-Agent')).toBe(`${USER_AGENT} agent/claude`)
  expect(fetchMock.mock.calls[1]).toEqual([presignedUrl, { headers: { 'x-custom': '1' } }])
})
