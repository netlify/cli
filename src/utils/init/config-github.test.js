// @ts-check
const octokit = require('@octokit/rest')
const sinon = require('sinon')

const githubAuth = require('../gh-auth')

let getAuthenticatedResponse

const octokitStub = sinon.stub(octokit, 'Octokit').callsFake(() => ({
  rest: {
    users: {
      getAuthenticated: () => {
        if (getAuthenticatedResponse instanceof Error) {
          throw getAuthenticatedResponse
        }
        return Promise.resolve(getAuthenticatedResponse)
      },
    },
  },
}))

// stub the await ghauth() call for a new token
sinon.stub(githubAuth, 'getGitHubToken').callsFake(() =>
  Promise.resolve({
    provider: 'github',
    token: 'new_token',
    user: 'spongebob',
  }),
)

const { getGitHubToken } = require('./config-github')

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
})

test('should create a octokit client with the provided token if the token is valid', async () => {
  getAuthenticatedResponse = { status: 200 }
  const token = await getGitHubToken({ globalConfig })
  expect(octokitStub.callCount).toBe(1)
  expect(octokitStub.getCall(0).args[0]).toEqual({ auth: 'token old_token' })
  expect(token).toBe('old_token')
  expect(globalConfig.get(`users.spongebob.auth.github`)).toEqual({
    provider: 'github',
    token: 'old_token',
    user: 'spongebob',
  })
  octokitStub.resetHistory()
})

test('should renew the github token when the provided token is not valid', async () => {
  getAuthenticatedResponse = new Error('Bad Credentials')
  getAuthenticatedResponse.status = 401
  const token = await getGitHubToken({ globalConfig })
  expect(octokitStub.callCount).toBe(1)
  expect(token).toBe('new_token')
  expect(octokitStub.getCall(0).args[0]).toEqual({ auth: 'token old_token' })
  expect(globalConfig.get(`users.spongebob.auth.github`)).toEqual({
    provider: 'github',
    token: 'new_token',
    user: 'spongebob',
  })
  octokitStub.resetHistory()
})
