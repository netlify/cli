import process from 'process'

import execa from 'execa'
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.mjs'
import { deploy as siteDeploy } from '../../../../src/commands/deploy/deploy.mjs'
import {areScopesEqual} from '../../../../src/commands/integration/deploy.mjs'
import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.cjs'

// describe('integration:deploy', () => {
//   beforeEach(async () => {
//     vi.clearAllMocks()
//   })


// })


// describe('integration:deploy areScopesEqual', () => {
//   test('it returns false when scopes are not equal', () => {
//     const localScopes = ['all'];
//     const registeredIntegrationScopes = ['all', 'env']

//     expect (areScopesEqual(localScopes, registeredIntegrationScopes)).toBe(false)
//   })
//   test('it returns true when scopes are equal', () => {
//     const localScopes = ['all', 'user'];
//     const registeredIntegrationScopes = ['user', 'all']

//     expect (areScopesEqual(localScopes, registeredIntegrationScopes)).toBe(true)
//   })
// })



describe(`mocking cli in same process`, () => {
	test("mocks pizza logger for funsies", async () => {
    vi.mock(`../../../../src/commands/deploy/deploy.mjs`, () => ({
      deploy: vi.fn(() => console.log(`yay it was mocked!`)),
      }))
      const siteInfo = {
        admin_url: 'https://app.netlify.com/sites/site-name/overview',
        ssl_url: 'https://site-name.netlify.app/',
        id: 'site_id',
        name: 'site-name',
        build_settings: { repo_url: 'https://github.com/owner/repo' },
      }
      const routes = [
        {
          path: 'accounts',
          response: [{ slug: 'test-account' }],
        },
        {
          path: 'sites',
          response: [],
        },
        { path: 'sites/site_id', response: siteInfo },
        { path: 'sites/site_id/service-instances', response: [] },
        {
          path: 'user',
          response: { name: 'test user', slug: 'test-user', email: 'user@test.com' },
        },
        {
          path: 'test-account/sites',
          method: 'post',
          response: siteInfo,
        },
      ]

      await withMockApi(routes, async ({apiUrl}) => {
        Object.assign(process.env, getEnvironmentVariables({apiUrl}))
        const program = new BaseCommand('netlify')
        const simulatedArgv = [
          "",
          "",
          "integration:deploy",
        ]
        try {
          console.log('hi')
          const someething = await program.parseAsync(simulatedArgv)
          console.log(someething)

        } catch (error) {
          console.log(error)
        }

        expect(siteDeploy).toBeCalledTimes(1)

      })

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
