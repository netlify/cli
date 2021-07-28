const test = require('ava')

const callCli = require('./utils/call-cli')
const { withMockApi, getCLIOptions } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')

const siteInfo = {
  account_slug: 'test-account',
  id: 'site_id',
  name: 'site-name',
  admin_url: 'https://app.netlify.com/sites/test-site/overview',
  url: 'https://test-site.netlify.app/',
}

const user = { full_name: 'Test User', email: 'test@netlify.com' }

const accounts = [{ slug: siteInfo.account_slug, name: user.full_name, roles_allowed: [] }]

const routes = [
  { path: 'sites/site_id', response: siteInfo },
  {
    path: 'accounts',
    response: accounts,
  },
  { path: 'user', response: user },
]

test('should print status for a linked site', async (t) => {
  await withSiteBuilder('linked-site', async (builder) => {
    await builder.buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      const output = await callCli(['status', '--json'], getCLIOptions({ builder, apiUrl }), true)
      const { account, siteData } = output
      t.deepEqual(siteData, {
        'admin-url': 'https://app.netlify.com/sites/test-site/overview',
        'site-id': 'site_id',
        'site-name': 'site-name',
        'site-url': 'https://test-site.netlify.app/',
      })
      t.is(typeof account.Email, 'string')
      t.is(typeof account.Name, 'string')
    })
  })
})
