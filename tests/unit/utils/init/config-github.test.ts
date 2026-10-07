import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { GlobalConfigStore } from '../../../../src/utils/types.js'

import { getGitHubToken } from '../../../../src/utils/init/config-github.js'

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: () => {},
}))

// stub the await ghauth() call for a new token
vi.mock('../../../../src/utils/gh-auth.js', () => ({
  getGitHubToken: () =>
    Promise.resolve({
      provider: 'github',
      token: 'new_token',
      user: 'spongebob',
    }),
}))

describe('getGitHubToken', () => {
  // mocked configstore
  let globalConfig: Pick<GlobalConfigStore, 'get' | 'set'>

  beforeEach(() => {
    const values = new Map<string, unknown>()
    globalConfig = {
      get: (key) => values.get(key),
      set: (key, value) => {
        values.set(key, value)
      },
    }
    globalConfig.set('userId', 'spongebob')
    globalConfig.set(`users.spongebob.auth.github`, {
      provider: 'github',
      token: 'old_token',
      user: 'spongebob',
    })

    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('should keep the stored token when GitHub accepts it', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ login: 'spongebob' }), { status: 200 }))

    const token = await getGitHubToken({ globalConfig })

    expect(fetch).toHaveBeenCalledOnce()
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'token old_token' })

    expect(token).toBe('old_token')
    expect(globalConfig.get(`users.spongebob.auth.github`)).toEqual({
      provider: 'github',
      token: 'old_token',
      user: 'spongebob',
    })
  })

  test('should renew the github token when the provided token is not valid', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 }))

    const token = await getGitHubToken({ globalConfig })

    expect(fetch).toHaveBeenCalledOnce()
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'token old_token' })

    expect(token).toBe('new_token')
    expect(globalConfig.get(`users.spongebob.auth.github`)).toEqual({
      provider: 'github',
      token: 'new_token',
      user: 'spongebob',
    })
  })
})
