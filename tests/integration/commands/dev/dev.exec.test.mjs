import process from 'process'

import { test } from 'vitest'

import callCli from '../../utils/call-cli.cjs'
import { withSiteBuilder } from '../../utils/site-builder.cjs'

test('should pass .env variables to exec command', async (t) => {
  await withSiteBuilder('site-env-file', async (builder) => {
    builder.withEnvFile({ env: { MY_SUPER_SECRET: 'SECRET' } })
    await builder.buildAsync()

    const cmd = process.platform === 'win32' ? 'set' : 'printenv'
    const output = await callCli(['dev:exec', cmd], {
      cwd: builder.directory,
    })

    t.expect(output.includes('Injected .env file env var: VITEST_TEST')).toBe(true)
    t.expect(output.includes('VITEST_TEST=ENV_VAR')).toBe(true)
  })
})
