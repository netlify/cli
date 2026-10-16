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
      Accept: 'application/vnd.github.v3+json',
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
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json; charset=utf-8' })
  })

  test('resolves to undefined for responses without content', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    await expect(requestGitHub(TOKEN, 'DELETE', '/repos/owner/repo/hooks/1')).resolves.toBeUndefined()
  })

  test('rejects with the status and an Octokit-compatible HttpError message on an error response', async () => {
    const documentationUrl = 'https://docs.github.com/rest'
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(401, { message: 'Bad credentials', documentation_url: documentationUrl }),
    )

    const error = await requestGitHub(TOKEN, 'GET', '/user').catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(GitHubAPIError)
    expect(error).toMatchObject({ name: 'HttpError', status: 401, message: `Bad credentials - ${documentationUrl}` })
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

  test('uses the raw body as the message when the error body is not JSON', async () => {
    const body = '<html>oops</html>'
    vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 502, statusText: 'Bad Gateway' }))

    const error = await requestGitHub(TOKEN, 'GET', '/user').catch((error_: unknown) => error_)

    expect(error).toMatchObject({ status: 502, message: body })
  })
})
