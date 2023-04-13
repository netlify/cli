import { expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.cjs'

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
  { path: 'sites/site_id/service-instances', response: [] },
  {
    path: 'accounts',
    response: accounts,
  },
  { path: 'user', response: user },
]

setupFixtureTests('empty-project', () => {
  test<FixtureTestContext>('should print status for a linked site', async ({ fixture }) => {
    await withMockApi(routes, async ({ apiUrl }) => {
      const { account, siteData } = await fixture.callCli(['status', '--json'], {
        execOptions: getCLIOptions({ apiUrl }),
        offline: false,
        parseJson: true,
      })

      expect(siteData).toMatchSnapshot()
      expect(account).toMatchSnapshot()
    })
  })
})
