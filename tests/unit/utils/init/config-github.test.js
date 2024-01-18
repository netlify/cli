import { Octokit } from '@octokit/rest'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getGitHubToken } from '../../../../dist/utils/init/config-github.js'

vi.mock('../../../../dist/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../dist/utils/command-helpers.js')),
  log: () => {},
}))

// stub the await ghauth() call for a new token
vi.mock('../../../../dist/utils/gh-auth.js', () => ({
  getGitHubToken: () =>
    Promise.resolve({
      provider: 'github',
      token: 'new_token',
      user: 'spongebob',
    }),
}))

vi.mock('@octokit/rest', () => {
  const Client = vi.fn()

  Client.prototype.rest = {
    users: { getAuthenticated: vi.fn() },
  }

  return {
    Octokit: Client,
  }
})

describe('getGitHubToken', () => {
  // mocked configstore
  let globalConfig

  beforeEach(() => {
    const values = new Map()
    globalConfig = {
      values: new Map(),
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

    Octokit.mockClear()
  })

  test('should create a octokit client with the provided token if the token is valid', async () => {
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
    Octokit.prototype.rest.users.getAuthenticated.mockImplementation(() => {
      const authError = new Error('Bad Credentials')
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
