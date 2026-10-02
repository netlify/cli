import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { GitHubAPIError, requestGitHub } from '../../../src/utils/github-api.js'

const TOKEN = 'gh_test_token'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestGitHub', () => {
  test('sends an authenticated request to the GitHub REST API and returns the parsed body', async () => {
    const user = { login: 'spongebob' }
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, user))

    const result = await requestGitHub<typeof user>(TOKEN, 'GET', '/user')

    expect(result).toEqual(user)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect((url as URL).href).toBe('https://api.github.com/user')
    expect(init?.method).toBe('GET')
    expect(init?.headers).toMatchObject({
      Accept: 'application/vnd.github+json',
      Authorization: `token ${TOKEN}`,
    })
    expect(init?.body).toBeUndefined()
  })

  test('encodes query parameters and serializes the JSON body', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(201, { id: 1 }))
    const body = { name: 'web', active: true }

    await requestGitHub(TOKEN, 'POST', '/repos/owner/repo/hooks', { query: { per_page: 100 }, body })

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect((url as URL).href).toBe('https://api.github.com/repos/owner/repo/hooks?per_page=100')
    expect(init?.body).toBe(JSON.stringify(body))
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  test('resolves to undefined for responses without content', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await expect(requestGitHub(TOKEN, 'DELETE', '/repos/owner/repo/hooks/1')).resolves.toBeUndefined()
  })

  test('rejects with the response status and message on an error response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(404, { message: 'Not Found' }))

    const error = await requestGitHub(TOKEN, 'GET', '/repos/owner/missing').catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(GitHubAPIError)
    expect(error).toMatchObject({ status: 404, message: 'Not Found' })
  })

  test('includes validation error details in the error message', async () => {
    const validationError = { resource: 'Hook', code: 'custom', message: 'Hook already exists on this repository' }
    vi.mocked(fetch).mockResolvedValue(jsonResponse(422, { message: 'Validation Failed', errors: [validationError] }))

    const error = await requestGitHub(TOKEN, 'POST', '/repos/owner/repo/hooks').catch((error_: unknown) => error_)

    expect(error).toMatchObject({
      status: 422,
      message: `Validation Failed: ${JSON.stringify(validationError)}`,
    })
  })

  test('falls back to the status text when the error body is not JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('<html>oops</html>', { status: 502, statusText: 'Bad Gateway' }))

    const error = await requestGitHub(TOKEN, 'GET', '/user').catch((error_: unknown) => error_)

    expect(error).toMatchObject({ status: 502, message: 'Bad Gateway' })
  })
})
