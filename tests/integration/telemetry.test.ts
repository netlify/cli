import { env as _env, version as nodejsVersion } from 'process'

import type { Options } from 'execa'
import execa from 'execa'
import { version as uuidVersion } from 'uuid'
import { expect, test } from 'vitest'

import { name, version } from '../../package.json'

import { callCli } from './utils/call-cli.js'
import { cliPath } from './utils/cli-path.js'
import { MockApiTestContext, withMockApi } from './utils/mock-api-vitest.js'
import { withSiteBuilder } from './utils/site-builder.ts'

const getCLIOptions = (apiUrl): Options => ({
  env: {
    NETLIFY_TEST_TRACK_URL: `${apiUrl}/track`,
    NETLIFY_TEST_IDENTIFY_URL: `${apiUrl}/identify`,
    NETLIFY_TEST_TELEMETRY_WAIT: 'true',
    NETLIFY_API_URL: apiUrl,
    PATH: _env.PATH,
    HOME: _env.HOME,
    APPDATA: _env.APPDATA,
  },
  extendEnv: false,
})

const routes = [
  { path: 'track', method: 'POST', response: {} },
  { path: 'sites', response: [] },
  { path: 'accounts', response: [] },
]

await withMockApi(routes, async () => {
  test<MockApiTestContext>('should not track --telemetry-disable', async ({ apiUrl, requests }) => {
    await callCli(['--telemetry-disable'], getCLIOptions(apiUrl))
    expect(requests).toEqual([])
  })

  const UUID_VERSION = 4

  test<MockApiTestContext>('should track --telemetry-enable', async ({ apiUrl, requests }) => {
    await callCli(['--telemetry-enable'], getCLIOptions(apiUrl))
    expect(requests.length).toBe(1)
    expect(requests[0].method).toBe('POST')
    expect(requests[0].path).toBe('/api/v1/track')
    expect(requests[0].headers['user-agent']).toBe(`${name}/${version}`)
    expect(requests[0].body.event).toBe('cli:user_telemetryEnabled')
    expect(uuidVersion(requests[0].body.anonymousId)).toBe(UUID_VERSION)
    expect(requests[0].body.properties).toEqual({ cliVersion: version, nodejsVersion })
  })

  test<MockApiTestContext>('should send netlify-cli/<version> user-agent', async ({ apiUrl, requests }) => {
    await callCli(['api', 'listSites'], getCLIOptions(apiUrl))
    const request = requests.find(({ path }) => path === '/api/v1/track')
    expect(request).toBeDefined()
    // example: netlify-cli/6.14.25 darwin-x64 node-v16.13.0
    const userAgent = request.headers['user-agent']
    expect(userAgent.startsWith(`${name}/${version}`)).toBe(true)
  })

  test<MockApiTestContext>('should send correct command on success', async ({ apiUrl, requests }) => {
    await callCli(['api', 'listSites'], getCLIOptions(apiUrl))
    const request = requests.find(({ path }) => path === '/api/v1/track')
    expect(request).toBeDefined()

    expect(typeof request.body.anonymousId).toBe('string')
    expect(Number.isInteger(request.body.duration)).toBe(true)
    expect(request.body.event).toBe('cli:command')
    expect(request.body.status).toBe('success')
    expect(request.body.properties).toEqual({
      buildSystem: [],
      cliVersion: version,
      command: 'api',
      monorepo: false,
      nodejsVersion,
      packageManager: 'npm',
    })
  })

  test<MockApiTestContext>('should send correct command on failure', async ({ apiUrl, requests }) => {
    await expect(callCli(['dev:exec', 'exit 1'], getCLIOptions(apiUrl))).rejects.toThrowError()
    const request = requests.find(({ path }) => path === '/api/v1/track')
    expect(request).toBeDefined()

    expect(typeof request.body.anonymousId).toBe('string')
    expect(Number.isInteger(request.body.duration)).toBe(true)
    expect(request.body.event).toBe('cli:command')
    expect(request.body.status).toBe('error')
    expect(request.body.properties).toEqual({
      buildSystem: [],
      cliVersion: version,
      command: 'dev:exec',
      monorepo: false,
      nodejsVersion,
      packageManager: 'npm',
    })
  })

  test('should add frameworks, buildSystem, and packageManager', async ({ apiUrl, requests }) => {
    await withSiteBuilder('nextjs-site', async (builder) => {
      await builder.withPackageJson({ packageJson: { dependencies: { next: '^12.13.0' } } }).buildAsync()

      await execa(cliPath, ['api', 'listSites'], {
        cwd: builder.directory,
        ...getCLIOptions(apiUrl),
      })

      const request = requests.find(({ path }) => path === '/api/v1/track')
      expect(request).toBeDefined()

      expect(typeof request.body.anonymousId).toBe('string')
      expect(Number.isInteger(request.body.duration)).toBe(true)
      expect(request.body.event).toBe('cli:command')
      expect(request.body.status).toBe('success')
      expect(request.body.properties).toEqual({
        frameworks: ['next'],
        buildSystem: [],
        cliVersion: version,
        command: 'api',
        monorepo: false,
        nodejsVersion,
        packageManager: 'npm',
      })
    })
  })
})
