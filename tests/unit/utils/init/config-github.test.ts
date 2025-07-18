import { Octokit } from '@octokit/rest'
import { beforeEach, describe, expect, test, vi } from 'vitest'
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

vi.mock('@octokit/rest', () => {
  const Client = vi.fn()

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  Client.prototype.rest = {
    users: { getAuthenticated: vi.fn() },
  }

  return {
    Octokit: Client,
  }
})

describe('getGitHubToken', () => {
  // mocked configstore
  let globalConfig: GlobalConfigStore

  beforeEach(() => {
    const values = new Map<string, unknown>()
    // @ts-expect-error FIXME(ndhoule): mock is not full, make it more realistic
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

    // @ts-expect-error: Missing from type definition
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    Octokit.mockClear()
  })

  test('should create a octokit client with the provided token if the token is valid', async () => {
    // @ts-expect-error: Missing from type definition
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    Octokit.prototype.rest.users.getAuthenticated.mockImplementation(() => Promise.resolve({ status: 200 }))

    const token = await getGitHubToken({ globalConfig })

    expect(Octokit).toHaveBeenCalledOnce()
    expect(Octokit).toHaveBeenCalledWith({ auth: 'token old_token' })

    expect(token).toBe('old_token')
    expect(globalConfig.get(`users.spongebob.auth.github`)).toEqual({
      provider: 'github',
      token: 'old_token',
      user: 'spongebob',
    })
  })

  test('should renew the github token when the provided token is not valid', async () => {
    // @ts-expect-error: Missing from type definition
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    Octokit.prototype.rest.users.getAuthenticated.mockImplementation(() => {
      const authError = new Error('Bad Credentials')
      // @ts-expect-error TS(2339) FIXME: Property 'status' does not exist on type 'Error'.
      authError.status = 401

      throw authError
    })
    const token = await getGitHubToken({ globalConfig })

    expect(Octokit).toHaveBeenCalledOnce()
    expect(Octokit).toHaveBeenCalledWith({ auth: 'token old_token' })

    expect(token).toBe('new_token')
    expect(globalConfig.get(`users.spongebob.auth.github`)).toEqual({
      provider: 'github',
      token: 'new_token',
      user: 'spongebob',
    })
  })
})
