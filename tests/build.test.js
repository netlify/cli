const path = require('path')
const test = require('ava')
const execa = require('execa')

const BIN_PATH = path.join(__dirname, '..', 'bin', 'run')
const FIXTURE_DIR = __dirname

// Runs `netlify build ...flags` then verify:
//  - its exit code is `exitCode`
//  - that its output contains `output`
// The command is run in the fixture directory `fixtureSubDir`.
const runBuildCommand = async function(
  t,
  fixtureSubDir,
  { exitCode: expectedExitCode = 0, output, flags = [], env } = {}
) {
  const { all, exitCode } = await execa(BIN_PATH, ['build', ...flags], {
    reject: false,
    cwd: `${FIXTURE_DIR}/${fixtureSubDir}`,
    env: { FORCE_COLOR: '1', NETLIFY_AUTH_TOKEN: 'test', ...env },
    all: true,
  })

  if (exitCode !== expectedExitCode) {
    console.error(all)
  }

  t.true(all.includes(output))
  t.is(exitCode, expectedExitCode)
}

test('build command - succeeds', async t => {
  await runBuildCommand(t, 'success-site', { output: 'testCommand' })
})

test('build command - fails', async t => {
  await runBuildCommand(t, 'failure-site', { exitCode: 1, output: 'doesNotExist' })
})

test('build command - uses the CLI mode', async t => {
  await runBuildCommand(t, 'success-site', { output: 'mode: cli' })
})

test('build command - can use the --dry flag', async t => {
  await runBuildCommand(t, 'success-site', { flags: ['--dry'], output: 'If this looks good to you' })
})

test('build command - can use the --context flag', async t => {
  await runBuildCommand(t, 'context-site', { flags: ['--context=staging'], output: 'testStaging' })
})

test('build command - can run in subdirectories', async t => {
  await runBuildCommand(t, 'subdir-site/subdir', { output: 'testCommand' })
})

test('build command - wrong config', async t => {
  await runBuildCommand(t, 'wrong-config-site', { exitCode: 1, output: 'Invalid syntax' })
})

test('build command - missing siteId', async t => {
  await runBuildCommand(t, 'success-site', {
    exitCode: 1,
    output: 'Could not find the site ID',
    env: { NODE_ENV: '' },
  })
})
