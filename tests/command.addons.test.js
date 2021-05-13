const test = require('ava')

const callCli = require('./utils/call-cli')
const { withMockApi, getCLIOptions } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')

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

test('netlify addons:list', async (t) => {
  await withSiteBuilder('site-with-addons', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['addons:list'], getCLIOptions({ builder, apiUrl }))
      t.true(cliResponse.includes('No addons currently installed'))
    })
  })
})

test('netlify addons:list --json', async (t) => {
  await withSiteBuilder('site-with-addons', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const cliResponse = await callCli(['addons:list', '--json'], getCLIOptions({ builder, apiUrl }))
      const json = JSON.parse(cliResponse)
      t.true(Array.isArray(json))
      t.is(json.length, 0)
    })
  })
})

test('netlify addons:create demo', async (t) => {
  await withSiteBuilder('site-with-addons', async (builder) => {
    await builder.buildAsync()

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
      t.true(cliResponse.includes('Add-on "demo" created'))
    })
  })
})

test('After creation netlify addons:list --json', async (t) => {
  await withSiteBuilder('site-with-addons', async (builder) => {
    await builder.buildAsync()

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
      t.true(Array.isArray(json))
      t.is(json.length, 1)
      t.is(json[0].service_slug, 'demo')
    })
  })
})

test('netlify addons:config demo', async (t) => {
  await withSiteBuilder('site-with-addons', async (builder) => {
    await builder.buildAsync()

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
      t.true(cliResponse.includes('Updating demo add-on config values'))
      t.true(cliResponse.includes('Add-on "demo" successfully updated'))
    })
  })
})

test('netlify addon:delete demo', async (t) => {
  await withSiteBuilder('site-with-addons', async (builder) => {
    await builder.buildAsync()

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
      const cliResponse = await callCli(['addons:delete', 'demo', '-f'], getCLIOptions({ builder, apiUrl }))
      t.true(cliResponse.includes('Addon "demo" deleted'))
    })
  })
})
