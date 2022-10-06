// @ts-check
const octokit = require('@octokit/rest')
const test = require('ava')
const sinon = require('sinon')

// eslint-disable-next-line import/order
const githubAuth = require('../../../../src/utils/gh-auth.cjs')

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

const { getGitHubToken } = require('../../../../src/utils/init/config-github.cjs')

// mocked configstore
let globalConfig

test.beforeEach(() => {
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

test.serial('should create a octokit client with the provided token if the token is valid', async (t) => {
  getAuthenticatedResponse = { status: 200 }
  const token = await getGitHubToken({ globalConfig })
  t.is(octokitStub.callCount, 1)
  t.deepEqual(octokitStub.getCall(0).args[0], { auth: 'token old_token' })
  t.is(token, 'old_token')
  t.deepEqual(globalConfig.get(`users.spongebob.auth.github`), {
    provider: 'github',
    token: 'old_token',
    user: 'spongebob',
  })
  octokitStub.resetHistory()
})

test.serial('should renew the github token when the provided token is not valid', async (t) => {
  getAuthenticatedResponse = new Error('Bad Credentials')
  getAuthenticatedResponse.status = 401
  const token = await getGitHubToken({ globalConfig })
  t.is(octokitStub.callCount, 1)
  t.is(token, 'new_token')
  t.deepEqual(octokitStub.getCall(0).args[0], { auth: 'token old_token' })
  t.deepEqual(globalConfig.get(`users.spongebob.auth.github`), {
    provider: 'github',
    token: 'new_token',
    user: 'spongebob',
  })
  octokitStub.resetHistory()
})
