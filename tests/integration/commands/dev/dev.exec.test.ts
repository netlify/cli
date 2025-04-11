import process from 'process'

import { test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { routes } from '../env/api-routes.js'

test('should pass .env variables to exec command', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    builder.withEnvFile({ env: { MY_SUPER_SECRET: 'SECRET' } })
    await builder.build()

    await withMockApi(routes, async ({ apiUrl }) => {
      const cmd = process.platform === 'win32' ? 'set' : 'printenv'
      const output = (await callCli(['dev:exec', cmd], getCLIOptions({ builder, apiUrl }))) as string

      t.expect(output).toContain('Injected .env file env var: MY_SUPER_SECRET')
      t.expect(output).toContain('MY_SUPER_SECRET=SECRET')
    })
  })
})
