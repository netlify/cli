const path = require('path')

const test = require('ava')
const execa = require('execa')

const cliPath = require('./utils/cli-path')
const { withMockApi } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')

const defaultEnvs = {
  NETLIFY_AUTH_TOKEN: 'fake-token',
  NETLIFY_SITE_ID: 'site_id',
  FORCE_COLOR: '1',
}

// Runs `netlify build ...flags` then verify:
//  - its exit code is `exitCode`
//  - that its output contains `output`
const runBuildCommand = async function (
  t,
  cwd,
  { apiUrl, exitCode: expectedExitCode = 0, output, flags = [], env = defaultEnvs } = {},
) {
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

  t.true(all.includes(output))
  t.is(exitCode, expectedExitCode)
}

const siteInfo = {
  account_slug: 'test-account',
  id: 'site_id',
  name: 'site-name',
}
const routes = [
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  {
    path: 'accounts',
    response: [{ slug: siteInfo.account_slug }],
  },
]

test('should print output for a successful command', async (t) => {
  await withSiteBuilder('success-site', async (builder) => {
    builder.withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })

    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      await runBuildCommand(t, builder.directory, { apiUrl, output: 'testCommand' })
    })
  })
})

test('should print output for a failed command', async (t) => {
  await withSiteBuilder('failure-site', async (builder) => {
    builder.withNetlifyToml({ config: { build: { command: 'doesNotExist' } } })

    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      await runBuildCommand(t, builder.directory, { apiUrl, exitCode: 2, output: 'doesNotExist' })
    })
  })
})

test('should run in dry mode when the --dry flag is set', async (t) => {
  await withSiteBuilder('success-site', async (builder) => {
    builder.withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })

    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      await runBuildCommand(t, builder.directory, { apiUrl, flags: ['--dry'], output: 'If this looks good to you' })
    })
  })
})

test('should run the production context when context is not defined', async (t) => {
  await withSiteBuilder('context-site', async (builder) => {
    builder.withNetlifyToml({
      config: {
        build: { command: 'echo testCommand' },
        context: { production: { command: 'echo testProduction' } },
      },
    })

    await builder.buildAsync()

    await runBuildCommand(t, builder.directory, { flags: ['--offline'], output: 'testProduction' })
  })
})

test('should run the deploy-preview context command when the --context option is set to deploy-preview', async (t) => {
  await withSiteBuilder('context-site', async (builder) => {
    builder.withNetlifyToml({
      config: {
        build: { command: 'echo testCommand' },
        context: { 'deploy-preview': { command: 'echo testDeployPreview' } },
      },
    })

    await builder.buildAsync()

    await runBuildCommand(t, builder.directory, {
      flags: ['--context=deploy-preview', '--offline'],
      output: 'testDeployPreview',
    })
  })
})

test('should run the deploy-preview context command when the context env variable is set', async (t) => {
  await withSiteBuilder('context-site', async (builder) => {
    builder.withNetlifyToml({
      config: {
        build: { command: 'echo testCommand' },
        context: { 'deploy-preview': { command: 'echo testDeployPreview' } },
      },
    })

    await builder.buildAsync()

    await runBuildCommand(t, builder.directory, {
      flags: ['--offline'],
      output: 'testDeployPreview',
      env: { CONTEXT: 'deploy-preview' },
    })
  })
})

test('should print debug information when the --debug flag is set', async (t) => {
  await withSiteBuilder('success-site', async (builder) => {
    builder.withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })

    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      await runBuildCommand(t, builder.directory, { apiUrl, flags: ['--debug'], output: 'Resolved config' })
    })
  })
})

test('should use root directory netlify.toml when runs in subdirectory', async (t) => {
  await withSiteBuilder('subdir-site', async (builder) => {
    builder
      .withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })
      .withContentFile({ path: path.join('subdir', '.gitkeep'), content: '' })

    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      await runBuildCommand(t, path.join(builder.directory, 'subdir'), { apiUrl, output: 'testCommand' })
    })
  })
})

test('should error when using invalid netlify.toml', async (t) => {
  await withSiteBuilder('wrong-config-site', async (builder) => {
    builder.withNetlifyToml({ config: { build: { command: false } } })

    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      await runBuildCommand(t, builder.directory, { apiUrl, exitCode: 1, output: 'Invalid syntax' })
    })
  })
})

test('should error when a site id is missing', async (t) => {
  await withSiteBuilder('no-site-id-site', async (builder) => {
    builder.withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })

    await builder.buildAsync()

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
  await withSiteBuilder('success-site', async (builder) => {
    await builder.withNetlifyToml({ config: { build: { command: 'echo testCommand' } } }).buildAsync()

    await runBuildCommand(t, builder.directory, {
      output: 'testCommand',
      flags: ['--offline'],
      env: {},
    })
  })
})

test('should not send network requests when offline flag is set', async (t) => {
  await withSiteBuilder('success-site', async (builder) => {
    await builder.withNetlifyToml({ config: { build: { command: 'echo testCommand' } } }).buildAsync()

    await withMockApi(routes, async ({ apiUrl, requests }) => {
      await runBuildCommand(t, builder.directory, {
        apiUrl,
        output: 'testCommand',
        flags: ['--offline'],
      })

      t.is(requests.length, 0)
    })
  })
})
