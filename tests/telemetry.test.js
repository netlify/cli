const test = require('ava')
const { version: uuidVersion } = require('uuid')

const callCli = require('./utils/call-cli')
const { withMockApi } = require('./utils/mock-api')

const getCLIOptions = (apiUrl) => ({
  env: {
    NETLIFY_TEST_TRACK_URL: `${apiUrl}/track`,
    NETLIFY_TEST_IDENTIFY_URL: `${apiUrl}/identify`,
    NETLIFY_TEST_TELEMETRY_WAIT: true,
    CI: undefined,
  },
})

const routes = [{ path: 'track', method: 'POST', response: {} }]

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
    t.is(requests[0].body.event, 'cli:user_telemetryEnabled')
    t.regex(requests[0].body.userId, /[a-zA-Z\d]{24}/)
    t.is(uuidVersion(requests[0].body.anonymousId), UUID_VERSION)
    t.deepEqual(requests[0].body.properties, {})
  })
})
