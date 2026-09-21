import { afterEach, describe, expect, test, vi } from 'vitest'

import { createGitHubClient, GitHubApiError } from '../../../src/utils/github-api.js'

const mockFetch = (status: number, body: unknown) => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  return fetchSpy
}

describe('createGitHubClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('sends the token and returns the parsed body', async () => {
    const fetchSpy = mockFetch(200, { login: 'spongebob' })

    const user = await createGitHubClient('abc123').getAuthenticatedUser()

    expect(user).toEqual({ login: 'spongebob' })
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.github.com/user')
    expect(init?.method).toBe('GET')
    expect((init?.headers as Record<string, string>).Authorization).toBe('token abc123')
  })

  test('encodes owner and repo and posts a JSON body', async () => {
    const fetchSpy = mockFetch(201, { id: 1 })

    await createGitHubClient('abc123').createWebhook({
      owner: 'my org',
      repo: 'my/repo',
      name: 'web',
      config: { url: 'https://example.com', content_type: 'json' },
      events: ['push'],
      active: true,
    })

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.github.com/repos/my%20org/my%2Frepo/hooks')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'web',
      config: { url: 'https://example.com', content_type: 'json' },
      events: ['push'],
      active: true,
    })
  })

  test('throws a GitHubApiError exposing status and structured error details', async () => {
    mockFetch(422, {
      message: 'Validation Failed',
      errors: [{ resource: 'Hook', code: 'custom', message: 'Hook already exists on this repository' }],
    })

    const error = await createGitHubClient('abc123')
      .getRepo({ owner: 'o', repo: 'r' })
      .catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(GitHubApiError)
    expect((error as GitHubApiError).status).toBe(422)
    expect((error as GitHubApiError).message).toBe('Validation Failed')
    expect((error as GitHubApiError).errors).toEqual([
      { resource: 'Hook', code: 'custom', message: 'Hook already exists on this repository' },
    ])
    expect((error as GitHubApiError).hasError((detail) => detail.resource === 'Hook')).toBe(true)
    expect((error as GitHubApiError).hasError((detail) => detail.resource === 'Repository')).toBe(false)
  })

  test('falls back to a generic message and empty details when the body has neither', async () => {
    mockFetch(500, undefined)

    const error = await createGitHubClient('abc123')
      .getRepo({ owner: 'o', repo: 'r' })
      .catch((error_: unknown) => error_)

    expect((error as GitHubApiError).status).toBe(500)
    expect((error as GitHubApiError).message).toBe('GitHub API request failed')
    expect((error as GitHubApiError).errors).toEqual([])
  })
})
