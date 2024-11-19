import { describe, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.ts'

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
describe.concurrent('command-addons', () => {
  test('netlify addons:list', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = await callCli(['addons:list'], getCLIOptions({ builder, apiUrl }))
        t.expect(cliResponse.includes('No addons currently installed')).toBe(true)
      })
    })
  })

  test('netlify addons:list --json', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = await callCli(['addons:list', '--json'], getCLIOptions({ builder, apiUrl }))
        const json = JSON.parse(cliResponse)
        t.expect(Array.isArray(json)).toBe(true)
        t.expect(json.length).toBe(0)
      })
    })
  })

  test('netlify addons:create demo', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      const createRoutes = [
        ...routes,
        { path: 'services/demo/manifest', response: {} },
        {
          path: 'sites/site_id/services/demo/instances',
          response: {},
          method: 'POST',
          requestBody: { config: { TWILIO_ACCOUNT_SID: 'foo' } },
        },
      ]

      await withMockApi(createRoutes, async ({ apiUrl }) => {
        const cliResponse = await callCli(
          ['addons:create', 'demo', '--TWILIO_ACCOUNT_SID', 'foo'],
          getCLIOptions({ builder, apiUrl }),
        )
        t.expect(cliResponse.includes('Add-on "demo" created')).toBe(true)
      })
    })
  })

  test('After creation netlify addons:list --json', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      const withExistingAddon = [
        { path: 'sites/site_id', response: siteInfo },
        {
          path: 'sites/site_id/service-instances',
          response: [{ service_slug: 'demo' }],
        },
        {
          path: 'accounts',
          response: [{ slug: siteInfo.account_slug }],
        },
      ]

      await withMockApi(withExistingAddon, async ({ apiUrl }) => {
        const cliResponse = await callCli(['addons:list', '--json'], getCLIOptions({ builder, apiUrl }))
        const json = JSON.parse(cliResponse)
        t.expect(Array.isArray(json)).toBe(true)
        t.expect(json.length).toBe(1)
        t.expect(json[0].service_slug).toEqual('demo')
      })
    })
  })

  test('netlify addons:config demo', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      const configRoutes = [
        { path: 'sites/site_id', response: siteInfo },
        {
          path: 'sites/site_id/service-instances',
          response: [{ id: 'demo', service_slug: 'demo', config: { TWILIO_ACCOUNT_SID: 'foo' } }],
        },
        {
          path: 'accounts',
          response: [{ slug: siteInfo.account_slug }],
        },
        { path: 'services/demo/manifest', response: { config: { TWILIO_ACCOUNT_SID: '' } } },
        {
          path: 'sites/site_id/services/demo/instances/demo',
          response: {},
          method: 'PUT',
          requestBody: { config: { TWILIO_ACCOUNT_SID: 'bar' } },
        },
      ]

      await withMockApi(configRoutes, async ({ apiUrl }) => {
        const cliResponse = await callCli(
          ['addons:config', 'demo', '--TWILIO_ACCOUNT_SID', 'bar'],
          getCLIOptions({ builder, apiUrl }),
        )
        t.expect(cliResponse.includes('Updating demo add-on config values')).toBe(true)
        t.expect(cliResponse.includes('Add-on "demo" successfully updated')).toBe(true)
      })
    })
  })

  test('netlify addon:delete demo', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      const deleteRoutes = [
        { path: 'sites/site_id', response: siteInfo },
        {
          path: 'sites/site_id/service-instances',
          response: [{ id: 'demo', service_slug: 'demo', config: { TWILIO_ACCOUNT_SID: 'foo' } }],
        },
        {
          path: 'accounts',
          response: [{ slug: siteInfo.account_slug }],
        },
        { path: 'services/demo/manifest', response: {} },
        {
          path: 'sites/site_id/services/demo/instances/demo',
          response: {},
          method: 'DELETE',
        },
      ]

      await withMockApi(deleteRoutes, async ({ apiUrl }) => {
        const cliResponse = await callCli(['addons:delete', 'demo', '--force'], getCLIOptions({ builder, apiUrl }))
        t.expect(cliResponse.includes('Addon "demo" deleted')).toBe(true)
      })
    })
  })
})
