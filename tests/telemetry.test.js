const process = require('process')

const { version: uuidVersion } = require('uuid')

const { name, version } = require('../package.json')

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

test('should not track --telemetry-disable', async () => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(['--telemetry-disable'], getCLIOptions(apiUrl))
    expect(requests).toEqual([])
  })
})

const UUID_VERSION = 4

test('should track --telemetry-enable', async () => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(['--telemetry-enable'], getCLIOptions(apiUrl))
    expect(requests.length).toBe(1)
    expect(requests[0].method).toBe('POST')
    expect(requests[0].path).toBe('/api/v1/track')
    expect(requests[0].headers['user-agent']).toBe(`${name}/${version}`)
    expect(requests[0].body.event).toBe('cli:user_telemetryEnabled')
    expect(uuidVersion(requests[0].body.anonymousId)).toBe(UUID_VERSION)
    expect(requests[0].body.properties).toEqual({})
  })
})

test('should send netlify-cli/<version> user-agent', async () => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(['api', 'listSites'], getCLIOptions(apiUrl))
    expect(requests.length !== 0).toBe(true)
    // example: netlify-cli/6.14.25 darwin-x64 node-v16.13.0
    const userAgent = requests[0].headers['user-agent']
    expect(userAgent.trim()).toMatch(new RegExp(`^${name}/${version}`, 'gm'))
  })
})
