import path from 'path'
import process from 'process'

import execa from 'execa'
import { describe, test, expect } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { cliPath } from '../../utils/cli-path.js'
import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.ts'
import { withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.ts'

const defaultEnvs = {
  NETLIFY_AUTH_TOKEN: 'fake-token',
  FORCE_COLOR: '1',
}

// Runs `netlify build ...flags` then verify:
//  - its exit code is `exitCode`
//  - that its output contains `output`
const runBuildCommand = async function (
  t,
  cwd,
  options: Partial<{
    exitCode: number
    flags: string[]
    output: any
    env: Record<string, string>
    apiUrl: string
  }> = {},
) {
  let { apiUrl, env = defaultEnvs, exitCode: expectedExitCode = 0, flags = [], output: outputs } = options
  const { all, exitCode } = await execa(cliPath, ['build', ...flags], {
    reject: false,
    cwd,
    env: {
      NETLIFY_API_URL: apiUrl,
      ...env,
    },
    all: true,
  })

  if (exitCode !== expectedExitCode) {
    console.error(all)
  }

  if (!Array.isArray(outputs)) {
    outputs = [outputs]
  }
  outputs.forEach((output) => {
    if (output instanceof RegExp) {
      t.expect(all).toMatch(output)
    } else {
      t.expect(all?.includes(output), `Output of build command does not include '${output}'`).toBe(true)
    }
  })
  t.expect(exitCode).toBe(expectedExitCode)
}

const siteInfo = {
  account_slug: 'test-account',
  id: 'site_id',
  name: 'site-name',
}
const siteInfoWithCommand = {
  ...siteInfo,
  build_settings: {
    cmd: 'echo uiCommand',
  },
}
const routes = [
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  {
    path: 'accounts',
    response: [{ slug: siteInfo.account_slug }],
  },
]
const routesWithCommand = [...routes]
routesWithCommand.splice(0, 1, { path: 'sites/site_id', response: siteInfoWithCommand })

describe.concurrent('command/build', () => {
  test('should use build command from UI', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({ config: {} }).withStateFile({ siteId: siteInfo.id })

      await builder.build()
      await withMockApi(routesWithCommand, async ({ apiUrl }) => {
        await runBuildCommand(t, builder.directory, { apiUrl, output: 'uiCommand' })
      })
    })
  })

  test('should use build command from UI with build plugin', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            plugins: [{ package: '/plugins/' }],
          },
        })
        .withStateFile({ siteId: siteInfo.id })
        .withBuildPlugin({
          name: 'index',
          plugin: {
            onPreBuild: ({ netlifyConfig }) => {
              console.log('test-pre-build')

              netlifyConfig.build.environment = netlifyConfig.build.environment || {}
              netlifyConfig.build.environment.TEST_123 = '12345'
            },
          },
        })

      await builder.build()
      await withMockApi(routesWithCommand, async ({ apiUrl }) => {
        await runBuildCommand(t, builder.directory, {
          apiUrl,
          output: ['uiCommand', 'test-pre-build'],
          env: {
            NETLIFY_AUTH_TOKEN: 'fake-token',
            FORCE_COLOR: '1',
          },
        })
      })
    })
  })

  test('should print output for a successful command', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })
        .withStateFile({ siteId: siteInfo.id })

      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await runBuildCommand(t, builder.directory, { apiUrl, output: 'testCommand' })
      })
    })
  })

  test('should print output for a failed command', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({ config: { build: { command: 'doesNotExist' } } }).withStateFile({ siteId: siteInfo.id })

      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await runBuildCommand(t, builder.directory, { apiUrl, exitCode: 2, output: 'doesNotExist' })
      })
    })
  })

  test('should run in dry mode when the --dry flag is set', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })
        .withStateFile({ siteId: siteInfo.id })

      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await runBuildCommand(t, builder.directory, { apiUrl, flags: ['--dry'], output: 'If this looks good to you' })
      })
    })
  })

  test('should run the production context when context is not defined', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({
        config: {
          build: { command: 'echo testCommand' },
          context: { production: { command: 'echo testProduction' } },
        },
      })

      await builder.build()

      await runBuildCommand(t, builder.directory, { flags: ['--offline'], output: 'testProduction' })
    })
  })

  test('should run the staging context command when the --context option is set to staging', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({
        config: {
          build: { command: 'echo testCommand' },
          context: { staging: { command: 'echo testStaging' } },
        },
      })

      await builder.build()

      await runBuildCommand(t, builder.directory, { flags: ['--context=staging', '--offline'], output: 'testStaging' })
    })
  })

  test('should run the staging context command when the context env variable is set', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({
        config: {
          build: { command: 'echo testCommand' },
          context: { staging: { command: 'echo testStaging' } },
        },
      })

      await builder.build()

      await runBuildCommand(t, builder.directory, {
        flags: ['--offline'],
        output: 'testStaging',
        env: { CONTEXT: 'staging' },
      })
    })
  })

  test('should print debug information when the --debug flag is set', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })
        .withStateFile({ siteId: siteInfo.id })

      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await runBuildCommand(t, builder.directory, { apiUrl, flags: ['--debug'], output: 'Resolved config' })
      })
    })
  })

  test('should use root directory netlify.toml when runs in subdirectory', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })
        .withStateFile({ siteId: siteInfo.id })
        .withContentFile({ path: path.join('subdir', '.gitkeep'), content: '' })

      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await runBuildCommand(t, path.join(builder.directory, 'subdir'), { apiUrl, output: 'testCommand' })
      })
    })
  })

  test('should error when using invalid netlify.toml', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({ config: { build: { command: false } } })

      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await runBuildCommand(t, builder.directory, { apiUrl, exitCode: 1, output: 'Invalid syntax' })
      })
    })
  })

  test('should error when a site id is missing', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })

      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await runBuildCommand(t, builder.directory, {
          apiUrl,
          exitCode: 1,
          output: 'Could not find the site ID',
          env: { ...defaultEnvs, NETLIFY_SITE_ID: '' },
        })
      })
    })
  })

  test('should not require a linked site when offline flag is set', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withNetlifyToml({ config: { build: { command: 'echo testCommand' } } }).build()

      await runBuildCommand(t, builder.directory, {
        output: 'testCommand',
        flags: ['--offline'],
        env: {},
      })
    })
  })

  test('should not send network requests when offline flag is set', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withNetlifyToml({ config: { build: { command: 'echo testCommand' } } }).build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        await runBuildCommand(t, builder.directory, {
          apiUrl,
          output: 'testCommand',
          flags: ['--offline'],
        })

        t.expect(requests.length).toBe(0)
      })
    })
  })

  test('should have version in NETLIFY_CLI_VERSION variable', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            build: {
              command:
                process.platform === 'win32'
                  ? 'echo NETLIFY_CLI_VERSION=%NETLIFY_CLI_VERSION%'
                  : 'echo NETLIFY_CLI_VERSION=$NETLIFY_CLI_VERSION',
            },
          },
        })
        .build()

      await runBuildCommand(t, builder.directory, {
        output: /NETLIFY_CLI_VERSION=\d+\.\d+.\d+/,
        flags: ['--offline'],
      })
    })
  })

  setupFixtureTests('next-app-without-config', () => {
    test<FixtureTestContext>('should run build without any netlify specific configuration and install auto detected plugins', async ({
      fixture,
    }) => {
      const output = await callCli(['build', '--offline'], { cwd: fixture.directory })

      // expect on the output that it installed the next runtime (auto detected the plugin + the build command and therefore had functions to bundle)
      expect(output).toMatch(/❯ Using Next.js Runtime -/)
      expect(output).toMatch(/\$ npm run build/)
      expect(output).toMatch(/Functions bundling completed/)
      expect(output).toMatch(/Edge Functions bundling completed/)
    })
  })
})
