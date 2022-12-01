const process = require('process')

const test = require('ava')

const callCli = require('./utils/call-cli.cjs')
const { withSiteBuilder } = require('./utils/site-builder.cjs')

test('should pass .env variables to exec command', async (t) => {
  await withSiteBuilder('site-env-file', async (builder) => {
    builder.withEnvFile({ env: { TEST: 'ENV_VAR' } })
    await builder.buildAsync()

    const cmd = process.platform === 'win32' ? 'set' : 'printenv'
    const output = await callCli(['dev:exec', cmd], {
      cwd: builder.directory,
    })

    t.is(output.includes('Loaded .env file env var: TEST'), true)
    t.is(output.includes('TEST=ENV_VAR'), true)
  })
})
