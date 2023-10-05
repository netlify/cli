import process from 'process'

import { getConfiguration } from '@netlify/sdk/cli-utils'
import { build as SdkBuild } from '@netlify/sdk/commands'
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.mjs'
import { deploy as siteDeploy } from '../../../../src/commands/deploy/deploy.mjs'
import {areScopesEqual, createDeployCommand, updateIntegration, registerIntegration} from '../../../../src/commands/integration/deploy.mjs'
import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.cjs'


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
  beforeEach(() => {
    vi.resetAllMocks()
  })
	test("deploys an integration", async () => {
    vi.mock(`../../../../src/commands/deploy/deploy.mjs`, () => ({
      deploy: vi.fn(() => console.log(`yay it was mocked!`)),
      }))
    vi.mock(`@netlify/sdk/commands`, () => ({
      build: vi.fn(() => console.log(`build!`)),
      }))
    vi.mock(`@netlify/sdk/cli-utils`, () => ({
      getConfiguration: vi.fn(),
      }))
    getConfiguration.mockReturnValue({name: 'integrationName', description: 'an integration', scopes: 'all', slug: '987645-integration'})
    vi.mock(`../../../../src/commands/integration/deploy.mjs`, async () => {
      const original = await vi.importActual<typeof import('../../../../src/commands/integration/deploy.mjs')>(`../../../../src/commands/integration/deploy.mjs`)
      return {
        ...original,
        registerIntegration: vi.fn(),
        updateIntegration: vi.fn(() => {
          console.log('hiii!')
        }),
      }
    })
    console.log(updateIntegration.mock)
      const siteInfo = {
        admin_url: 'https://app.netlify.com/sites/site-name/overview',
        ssl_url: 'https://site-name.netlify.app/',
        url: 'https:/app.netlify.com/whatever',
        id: 'site_id',
        name: 'site-name',
        build_settings: { repo_url: 'https://github.com/owner/repo' },
        accountId: 'test-account'
      }

      const routes = [
        {
          path: 'accounts',
          response: [{ id: 'test-account' }],
        },
        { path: 'sites/site_id/service-instances', response: [] },
        { path: 'sites/site_id', response: siteInfo },
        {
          path: 'sites',
          response: [siteInfo],
        },
        { path: 'sites/site_id', method: 'patch', response: {} },
        { path: 'test-account/integrations', response: {} },
      ]



        await withMockApi(routes, async ({apiUrl}) => {
          const envVars = getEnvironmentVariables({apiUrl})
          envVars.INTEGRATION_URL = apiUrl

          Object.assign(process.env, envVars)
          const program = new BaseCommand('netlify')

          createDeployCommand(program)
          const simulatedArgv = [
            "",
            "",
            "integration:deploy",
          ]
          try {
            await program.parseAsync(simulatedArgv)

          } catch (error) {
            console.log(error)
          }

          expect(SdkBuild).toBeCalledTimes(1)
          expect(siteDeploy).toBeCalledTimes(1)

        })
      })



})
