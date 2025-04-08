import { env as _env, version as nodejsVersion } from 'process'

import type { Options } from 'execa'
import execa from 'execa'
import { expect, test } from 'vitest'

import pkg from '../../package.json'

import { callCli } from './utils/call-cli.js'
import { cliPath } from './utils/cli-path.js'
import { MockApiTestContext, withMockApi } from './utils/mock-api-vitest.js'
import { withSiteBuilder } from './utils/site-builder.js'

const getCLIOptions = (apiUrl: string): Options => ({
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
  { path: 'track', method: 'POST' as const, response: {} },
  { path: 'sites', response: [] },
  { path: 'accounts', response: [] },
]

await withMockApi(routes, () => {
  test<MockApiTestContext>('should not track --telemetry-disable', async ({ apiUrl, requests }) => {
    await callCli(['--telemetry-disable'], getCLIOptions(apiUrl))
    expect(requests).toEqual([])
  })

  test<MockApiTestContext>('should track --telemetry-enable', async ({ apiUrl, requests }) => {
    await callCli(['--telemetry-enable'], getCLIOptions(apiUrl))
    expect(requests.length).toBe(1)
    expect(requests[0].method).toBe('POST')
    expect(requests[0].path).toBe('/api/v1/track')
    expect(requests[0].headers['user-agent']).toBe(`${pkg.name}/${pkg.version}`)
    expect(requests[0].body).toHaveProperty('event', 'cli:user_telemetryEnabled')
    expect(requests[0].body).toHaveProperty('anonymousId', expect.any(String))
    expect(requests[0].body).toHaveProperty('properties', { cliVersion: pkg.version, nodejsVersion })
  })

  test<MockApiTestContext>('should send netlify-cli/<version> user-agent', async ({ apiUrl, requests }) => {
    await callCli(['api', 'listSites'], getCLIOptions(apiUrl))
    const request = requests.find(({ path }) => path === '/api/v1/track')
    expect(request).toBeDefined()
    // example: netlify-cli/6.14.25 darwin-x64 node-v16.13.0
    const userAgent = request!.headers['user-agent']
    expect(userAgent).toBeDefined()
    expect(userAgent!.startsWith(`${pkg.name}/${pkg.version}`)).toBe(true)
  })

  test<MockApiTestContext>('should send invoked command on success', async ({ apiUrl, requests }) => {
    await callCli(['api', 'listSites'], getCLIOptions(apiUrl))
    const request = requests.find(({ path }) => path === '/api/v1/track')
    expect(request).toBeDefined()

    expect(request!.body).toHaveProperty('anonymousId', expect.any(String))
    expect(request!.body).toHaveProperty('duration', expect.any(Number))
    expect(request!.body).toHaveProperty('event', 'cli:command')
    expect(request!.body).toHaveProperty('status', 'success')
    expect(request!.body).toHaveProperty('properties', {
      buildSystem: [],
      cliVersion: pkg.version,
      command: 'api',
      // Varies depending on node.js version tested
      didEnableCompileCache: expect.any(Boolean),
      monorepo: false,
      nodejsVersion,
      // TODO: this should be NPM however some CI tests are using pnpm which changes the value
      packageManager: expect.stringMatching(/npm|pnpm/),
    })
  })

  test<MockApiTestContext>('should send invoked command on failure', async ({ apiUrl, requests }) => {
    await expect(callCli(['dev:exec', 'exit 1'], getCLIOptions(apiUrl))).rejects.toThrowError()
    const request = requests.find(({ path }) => path === '/api/v1/track')
    expect(request).toBeDefined()

    expect(request!.body).toHaveProperty('anonymousId', expect.any(String))
    expect(request!.body).toHaveProperty('duration', expect.any(Number))
    expect(request!.body).toHaveProperty('event', 'cli:command')
    expect(request!.body).toHaveProperty('status', 'error')
    expect(request!.body).toHaveProperty('properties', {
      buildSystem: [],
      cliVersion: pkg.version,
      command: 'dev:exec',
      // Varies depending on node.js version tested
      didEnableCompileCache: expect.any(Boolean),
      monorepo: false,
      nodejsVersion,
      // TODO: this should be NPM however some CI tests are using pnpm which changes the value
      packageManager: expect.stringMatching(/npm|pnpm/),
    })
  })

  test<MockApiTestContext>('should add frameworks, buildSystem, and packageManager', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withPackageJson({ packageJson: { dependencies: { next: '^12.13.0' } } }).build()

      await execa(cliPath, ['api', 'listSites'], {
        cwd: builder.directory,
        ...getCLIOptions(t.apiUrl),
      })

      const request = t.requests.find(({ path }) => path === '/api/v1/track')
      expect(request).toBeDefined()

      expect(request!.body).toHaveProperty(
        'properties',
        expect.objectContaining({
          frameworks: ['next'],
          buildSystem: [],
          // TODO: this should be NPM however some CI tests are using pnpm which changes the value
          packageManager: expect.stringMatching(/npm|pnpm/),
        }),
      )
    })
  })
})
