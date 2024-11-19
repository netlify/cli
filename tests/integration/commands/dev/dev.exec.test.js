import process from 'process'

import { test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.ts'
import { routes } from '../env/api-routes.ts'

test('should pass .env variables to exec command', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    builder.withEnvFile({ env: { MY_SUPER_SECRET: 'SECRET' } })
    await builder.build()

    await withMockApi(routes, async ({ apiUrl }) => {
      const cmd = process.platform === 'win32' ? 'set' : 'printenv'
      const output = await callCli(['dev:exec', cmd], getCLIOptions({ builder, apiUrl }))

      t.expect(output.includes('Injected .env file env var: MY_SUPER_SECRET')).toBe(true)
      t.expect(output.includes('MY_SUPER_SECRET=SECRET')).toBe(true)
    })
  })
})
