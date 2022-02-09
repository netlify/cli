const process = require('process')

const test = require('ava')
const { version: uuidVersion } = require('uuid')

const { name, version } = require('../../package.json')

const callCli = require('./utils/call-cli')
const { withMockApi } = require('./utils/mock-api')

const getCLIOptions = (apiUrl) => ({
  env: {
    NETLIFY_TEST_TRACK_URL: `${apiUrl}/track`,
    NETLIFY_TEST_IDENTIFY_URL: `${apiUrl}/identify`,
    NETLIFY_TEST_TELEMETRY_WAIT: true,
    NETLIFY_API_URL: apiUrl,
    PATH: process.env.PATH,
  },
  extendEnv: false,
})

const routes = [
  { path: 'track', method: 'POST', response: {} },
  { path: 'sites', response: [] },
]

test.serial('should not track --telemetry-disable', async (t) => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(['--telemetry-disable'], getCLIOptions(apiUrl))
    t.deepEqual(requests, [])
  })
})

const UUID_VERSION = 4

test.serial('should track --telemetry-enable', async (t) => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(['--telemetry-enable'], getCLIOptions(apiUrl))
    t.is(requests.length, 1)
    t.is(requests[0].method, 'POST')
    t.is(requests[0].path, '/api/v1/track')
    t.is(requests[0].headers['user-agent'], `${name}/${version}`)
    t.is(requests[0].body.event, 'cli:user_telemetryEnabled')
    t.is(uuidVersion(requests[0].body.anonymousId), UUID_VERSION)
    t.deepEqual(requests[0].body.properties, {})
  })
})

test('should send netlify-cli/<version> user-agent', async (t) => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(['api', 'listSites'], getCLIOptions(apiUrl))
    const request = requests.find(({ path }) => path === '/api/v1/track')
    t.truthy(request)
    // example: netlify-cli/6.14.25 darwin-x64 node-v16.13.0
    const userAgent = request.headers['user-agent']
    t.assert(userAgent.startsWith(`${name}/${version}`))
  })
})

test('should send correct command on success', async (t) => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(['api', 'listSites'], getCLIOptions(apiUrl))
    const request = requests.find(({ path }) => path === '/api/v1/track')
    t.truthy(request)

    t.true(typeof request.body.anonymousId === 'string')
    t.true(Number.isInteger(request.body.duration))
    t.is(request.body.event, 'cli:command')
    t.is(request.body.status, 'success')
    t.deepEqual(request.body.properties, { command: 'api' })
  })
})

test('should send correct command on failure', async (t) => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await t.throwsAsync(() => callCli(['dev:exec', 'exit 1'], getCLIOptions(apiUrl)))
    const request = requests.find(({ path }) => path === '/api/v1/track')
    t.truthy(request)

    t.true(typeof request.body.anonymousId === 'string')
    t.true(Number.isInteger(request.body.duration))
    t.is(request.body.event, 'cli:command')
    t.is(request.body.status, 'error')
    t.deepEqual(request.body.properties, { command: 'dev:exec' })
  })
})
