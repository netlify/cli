import process from 'process'

import execa from 'execa'
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import {areScopesEqual} from '../../../../src/commands/integration/deploy.mjs'
import callCli from '../../utils/call-cli.cjs'
import cliPath from '../../utils/cli-path.cjs'
import { createLiveTestSite, generateSiteName } from '../../utils/create-live-test-site.cjs'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.cjs'
import { withSiteBuilder } from '../../utils/site-builder.cjs'

// describe('integration:deploy', () => {
//   beforeEach(async () => {
//     vi.clearAllMocks()
//   })


// })

const SITE_NAME = generateSiteName('netlify-integration-deploy-')

describe('integration:deploy areScopesEqual', () => {
  test('it returns false when scopes are not equal', () => {
    const localScopes = ['all'];
    const registeredIntegrationScopes = ['all', 'env']

    expect (areScopesEqual(localScopes, registeredIntegrationScopes)).toBe(false)
  })
  test('it returns true when scopes are equal', () => {
    const localScopes = ['all', 'user'];
    const registeredIntegrationScopes = ['user', 'all']

    expect (areScopesEqual(localScopes, registeredIntegrationScopes)).toBe(true)
  })
})

// if (process.env.NETLIFY_TEST_DISABLE_LIVE !== 'true') {

//   const routes = [
//     { path: 'track', method: 'POST', response: {} },
//     { path: 'sites', response: [] },
//     { path: 'accounts', response: [] },
//   ]
// describe.concurrent('integration:deploy', async () => {
//   let integrationSiteId
//   let integrationAccount
//   const { account, siteId } = await createLiveTestSite(SITE_NAME)
//   integrationSiteId = siteId
//   integrationAccount = account
//   beforeAll(async (context) => {})


//   test('deploys integration', async () => {
//     await withSiteBuilder('integration', async (builder) => {
//       await builder.buildAsync()

//       await withMockApi(routes, async ({ apiUrl }) => {

//         await execa(cliPath, ['integration:deploy'], {
//           ...getCLIOptions({apiUrl, builder}),
//         })



//       })

//     })
//   })
// })

// }
