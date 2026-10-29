import { mkdtemp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env as _env, version as nodejsVersion } from 'process'

import type { Options } from 'execa'
import { expect, test } from 'vitest'

import { callCli } from './utils/call-cli.js'
import { withMockApi } from './utils/mock-api.js'
import { withSiteBuilder } from './utils/site-builder.js'

const pkg = createRequire(import.meta.url)('../../package.json') as { name: string; version: string }

// The global config lives under the home dir, and these tests toggle `telemetryDisabled` in it.
const homeDir = await mkdtemp(join(tmpdir(), 'netlify-cli-telemetry-test-'))

const getCLIOptions = (apiUrl: string, env: Record<string, string> = {}): Options => ({
  env: {
    NETLIFY_TEST_TRACK_URL: `${apiUrl}/track`,
    NETLIFY_TEST_IDENTIFY_URL: `${apiUrl}/identify`,
    NETLIFY_TEST_TELEMETRY_WAIT: 'true',
    NETLIFY_API_URL: apiUrl,
    NETLIFY_AUTH_TOKEN: 'fake-token',
    PATH: _env.PATH,
    HOME: homeDir,
    APPDATA: homeDir,
    ...env,
  },
  extendEnv: false,
})

const routes = [
  { path: 'track', method: 'POST' as const, response: {} },
  { path: 'sites', response: [] },
  { path: 'accounts', response: [] },
]

test('should not track --telemetry-disable', async () => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(['--telemetry-disable'], getCLIOptions(apiUrl))
    expect(requests).toEqual([])
  })
})

test('should track --telemetry-enable', async () => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(['--telemetry-enable'], getCLIOptions(apiUrl))
    expect(requests.length).toBe(1)
    expect(requests[0].method).toBe('POST')
    expect(requests[0].path).toBe('/api/v1/track')
    expect(requests[0].headers['user-agent']).toBe(`${pkg.name}/${pkg.version}`)
    expect(requests[0].body).toHaveProperty('event', 'cli:user_telemetryEnabled')
    expect(requests[0].body).toHaveProperty('anonymousId', expect.any(String))
    expect(requests[0].body).toHaveProperty('properties', { cliVersion: pkg.version, nodejsVersion })
  })
})

test('should track in CI', async () => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(['api', 'listSites'], getCLIOptions(apiUrl, { CI: 'true' }))
    const request = requests.find(({ path }) => path === '/api/v1/track')
    expect(request).toBeDefined()
    expect(request?.body).not.toHaveProperty('properties.ci_vendor')
  })
})

test('should send the CI vendor and pull request status', async () => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(
      ['api', 'listSites'],
      getCLIOptions(apiUrl, { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request' }),
    )
    const request = requests.find(({ path }) => path === '/api/v1/track')
    expect(request?.body).toHaveProperty(
      'properties',
      expect.objectContaining({ ci_vendor: 'GITHUB_ACTIONS', ci_is_pr: true }),
    )
  })
})

test('should not track when NETLIFY_TELEMETRY_DISABLED is set', async () => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(['api', 'listSites'], getCLIOptions(apiUrl, { NETLIFY_TELEMETRY_DISABLED: '1' }))
    expect(requests.find(({ path }) => path === '/api/v1/track')).toBeUndefined()
  })
})

test('should send netlify-cli/<version> user-agent', async () => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(['api', 'listSites'], getCLIOptions(apiUrl))
    const request = requests.find(({ path }) => path === '/api/v1/track')
    expect(request).toBeDefined()
    // example: netlify-cli/6.14.25 darwin-x64 node-v16.13.0
    const userAgent = request!.headers['user-agent']
    expect(userAgent).toBeDefined()
    expect(userAgent!.startsWith(`${pkg.name}/${pkg.version}`)).toBe(true)
  })
})

test('should send invoked command on success', async () => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
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
      opts: expect.any(Object),
      args: expect.any(Array),
      // TODO: this should be NPM however some CI tests are using pnpm which changes the value
      packageManager: expect.stringMatching(/npm|pnpm/),
    })
  })
})

test('should send invoked command on failure', async () => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await expect(callCli(['dev:exec', 'exit 1'], getCLIOptions(apiUrl))).rejects.toThrow()
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
      opts: expect.any(Object),
      args: expect.any(Array),
      // TODO: this should be NPM however some CI tests are using pnpm which changes the value
      packageManager: expect.stringMatching(/npm|pnpm/),
    })
  })
})

test('should add frameworks, buildSystem, and packageManager', async (t) => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withPackageJson({ packageJson: { dependencies: { next: '^12.13.0' } } }).build()

      await callCli(['api', 'listSites'], { cwd: builder.directory, ...getCLIOptions(apiUrl) })

      const request = requests.find(({ path }) => path === '/api/v1/track')
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

test('should attach user options as `opts` and positional args as `args`', async () => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await expect(
      callCli(['blobs:get', '--filter', 'web', '-O', './output_dir', 'my-store', 'my-key'], getCLIOptions(apiUrl)),
    ).rejects.toThrow(/You don't appear to be in a folder that is linked to a project/)
    const request = requests.find(({ path }) => path === '/api/v1/track')
    expect(request).toBeDefined()

    expect(request!.body).toHaveProperty('event', 'cli:command')
    expect(request!.body).toHaveProperty(
      'properties',
      expect.objectContaining({
        command: 'blobs:get',
        opts: {
          filter: { source: 'cli', value: 'web' },
          output: { source: 'cli', value: './output_dir' },
        },
        args: ['my-store', 'my-key'],
      }),
    )
  })
})

test('should scrub values of sensitive `opts`', async () => {
  await withMockApi(routes, async ({ apiUrl, requests }) => {
    await callCli(['api', 'listSites', '--auth', 'my-sensitive-token'], getCLIOptions(apiUrl))
    const request = requests.find(({ path }) => path === '/api/v1/track')
    expect(request).toBeDefined()

    expect(request!.body).toHaveProperty('event', 'cli:command')
    expect(request!.body).toHaveProperty(
      'properties',
      expect.objectContaining({
        command: 'api',
        opts: {
          auth: { source: 'cli', value: '********' },
          list: { source: 'default', value: false },
        },
        args: ['listSites'],
      }),
    )
  })
})
