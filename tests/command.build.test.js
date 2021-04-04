const path = require('path')
const process = require('process')

const test = require('ava')
const execa = require('execa')

const cliPath = require('./utils/cli-path')
const { withSiteBuilder } = require('./utils/site-builder')

// Runs `netlify build ...flags` then verify:
//  - its exit code is `exitCode`
//  - that its output contains `output`
// The command is run in the fixture directory `fixtureSubDir`.
const runBuildCommand = async function (t, cwd, { exitCode: expectedExitCode = 0, output, flags = [], env } = {}) {
  const { all, exitCode } = await execa(cliPath, ['build', ...flags], {
    reject: false,
    cwd,
    env: { FORCE_COLOR: '1', ...env },
    all: true,
  })

  if (exitCode !== expectedExitCode) {
    console.error(all)
  }

  t.true(all.includes(output))
  t.is(exitCode, expectedExitCode)
}

if (process.env.IS_FORK !== 'true') {
  test('should print output for a successful command', async (t) => {
    await withSiteBuilder('success-site', async (builder) => {
      builder.withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })

      await builder.buildAsync()

      await runBuildCommand(t, builder.directory, { output: 'testCommand' })
    })
  })

  test('should print output for a failed command', async (t) => {
    await withSiteBuilder('failure-site', async (builder) => {
      builder.withNetlifyToml({ config: { build: { command: 'doesNotExist' } } })

      await builder.buildAsync()

      await runBuildCommand(t, builder.directory, { exitCode: 2, output: 'doesNotExist' })
    })
  })

  test('should run in dry mode when the --dry flag is set', async (t) => {
    await withSiteBuilder('success-site', async (builder) => {
      builder.withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })

      await builder.buildAsync()

      await runBuildCommand(t, builder.directory, { flags: ['--dry'], output: 'If this looks good to you' })
    })
  })

  test('should run the staging context command when the --context option is set to staging', async (t) => {
    await withSiteBuilder('context-site', async (builder) => {
      builder.withNetlifyToml({
        config: {
          build: { command: 'echo testCommand' },
          context: { staging: { command: 'echo testStaging' } },
        },
      })

      await builder.buildAsync()

      await runBuildCommand(t, builder.directory, { flags: ['--context=staging'], output: 'testStaging' })
    })
  })

  test('should print debug information when the --debug flag is set', async (t) => {
    await withSiteBuilder('success-site', async (builder) => {
      builder.withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })

      await builder.buildAsync()

      await runBuildCommand(t, builder.directory, { flags: ['--debug'], output: 'Resolved config' })
    })
  })

  test('should use root directory netlify.toml when runs in subdirectory', async (t) => {
    await withSiteBuilder('subdir-site', async (builder) => {
      builder
        .withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })
        .withContentFile({ path: path.join('subdir', '.gitkeep'), content: '' })

      await builder.buildAsync()

      await runBuildCommand(t, path.join(builder.directory, 'subdir'), { output: 'testCommand' })
    })
  })

  test('should error when using invalid netlify.toml', async (t) => {
    await withSiteBuilder('wrong-config-site', async (builder) => {
      builder.withNetlifyToml({ config: { build: { command: false } } })

      await builder.buildAsync()

      await runBuildCommand(t, builder.directory, { exitCode: 1, output: 'Invalid syntax' })
    })
  })

  test('should error when a site id is missing', async (t) => {
    await withSiteBuilder('success-site', async (builder) => {
      builder.withNetlifyToml({ config: { build: { command: 'echo testCommand' } } })

      await builder.buildAsync()

      await runBuildCommand(t, builder.directory, {
        exitCode: 1,
        output: 'Could not find the site ID',
        env: { NODE_ENV: '' },
      })
    })
  })
}
