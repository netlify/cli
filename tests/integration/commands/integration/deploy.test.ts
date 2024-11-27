import process from 'process'

import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { deploy as siteDeploy } from '../../../../src/commands/deploy/deploy.js'
import { areScopesEqual } from '../../../../src/commands/integration/deploy.js'
import { createIntegrationDeployCommand } from '../../../../src/commands/integration/index.js'
import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.ts'

describe('integration:deploy areScopesEqual', () => {
  test('it returns false when scopes are not equal', () => {
    const localScopes = ['all']
    const registeredIntegrationScopes = ['all', 'env']

    expect(areScopesEqual(localScopes, registeredIntegrationScopes)).toBe(false)
  })
  test('it returns true when scopes are equal', () => {
    const localScopes = ['all', 'user']
    const registeredIntegrationScopes = ['user', 'all']

    expect(areScopesEqual(localScopes, registeredIntegrationScopes)).toBe(true)
  })
})

const originalEnv = process.env

describe(`integration:deploy`, () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    Object.defineProperty(process, 'env', {
      value: originalEnv,
    })
  })

  afterAll(() => {
    vi.resetModules()
    vi.restoreAllMocks()

    Object.defineProperty(process, 'env', {
      value: originalEnv,
    })
  })

  test('deploys an integration', async (t) => {
    vi.mock(`../../../../src/commands/deploy/deploy.js`, () => ({
      deploy: vi.fn(() => console.log(`yay it was mocked!`)),
    }))

    const siteInfo = {
      admin_url: 'https://app.netlify.com/sites/site-name/overview',
      ssl_url: 'https://site-name.netlify.app/',
      url: 'https:/app.netlify.com/whatever',
      id: 'site_id',
      name: 'site-name',
      build_settings: { repo_url: 'https://github.com/owner/repo' },
      accountId: 'test-account',
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
      {
        path: 'test-account/integrations',
        response: {
          scopes: `site:read`,
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      builder.withContentFiles([
        {
          path: 'integration.yaml',
          content: `config:
  name: integrationName
  description: an integration'
  slug: 987645-integration
  scopes:
    site:
        - read
      `,
        },
      ])
      await builder.build()

      vi.spyOn(process, 'cwd').mockReturnValue(builder.directory)

      await withMockApi(routes, async ({ apiUrl }) => {
        const envVars = getEnvironmentVariables({ apiUrl })
        envVars.INTEGRATION_URL = apiUrl

        Object.assign(process.env, envVars)
        const program = new BaseCommand('netlify')

        createIntegrationDeployCommand(program)
        const simulatedArgv = ['', '', 'integration:deploy']

        try {
          await program.parseAsync(simulatedArgv)
        } catch (error) {
          console.log(error)
        }

        expect(siteDeploy).toBeCalledTimes(1)
      })
    })
  })
})
