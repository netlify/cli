const process = require('process')

const callCli = require('./utils/call-cli')
const { withSiteBuilder } = require('./utils/site-builder')
const { normalize } = require('./utils/snapshots')

test('should pass .env variables to exec command', async () => {
  await withSiteBuilder('site-env-file', async (builder) => {
    builder.withEnvFile({ env: { TEST: 'ENV_VAR' } })
    await builder.buildAsync()

    const cmd = process.platform === 'win32' ? 'set' : 'printenv'
    const output = await callCli(['dev:exec', cmd], {
      cwd: builder.directory,
    })

    const normalizedOutput = normalize(output)

    expect(normalizedOutput.includes('Injected .env file env var: TEST')).toBe(true)
    expect(normalizedOutput.includes('TEST=ENV_VAR')).toBe(true)
  })
})
