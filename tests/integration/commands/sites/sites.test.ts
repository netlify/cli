import process from 'process'

import inquirer from 'inquirer'
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createSitesCreateCommand } from '../../../../src/commands/sites/sites.js'
import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.js'

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: () => {},
}))

// mock the getGithubToken method with a fake token
vi.mock('../../../../src/utils/init/config-github.js', () => ({
  getGitHubToken: vi.fn().mockImplementation(() => 'my-token'),
}))

vi.mock('../../../../src/utils/sites/utils.js', () => ({
  getTemplatesFromGitHub: vi.fn().mockImplementation(() => [
    {
      name: 'next-starter',
      html_url: 'http://github.com/netlify-templates/next-starter',
      full_name: 'netlify-templates/next-starter',
    },
    {
      name: 'archived-starter',
      html_url: 'https://github.com/netlify-templates/fake-repo',
      full_name: 'netlify-templates/fake-repo',
      archived: true,
    },
  ]),
}))

vi.mock('prettyjson', async () => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const realRender = (await vi.importActual('prettyjson')) as typeof import('prettyjson')

  return {
    ...realRender,
    render: vi.fn().mockImplementation((...args: Parameters<typeof realRender.render>) => realRender.render(...args)),
  }
})

vi.spyOn(inquirer, 'prompt').mockImplementation(() => Promise.resolve({ accountSlug: 'test-account' }))

const siteInfo = {
  admin_url: 'https://app.netlify.com/projects/site-name/overview',
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
    method: 'POST' as const,
    response: siteInfo,
  },
]

const OLD_ENV = process.env

describe('sites command', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    Object.defineProperty(process, 'env', { value: {} })
  })

  afterAll(() => {
    vi.resetModules()
    vi.restoreAllMocks()

    Object.defineProperty(process, 'env', {
      value: OLD_ENV,
    })
  })

  describe('sites:create', () => {
    test('should throw error when name flag is incorrect', async () => {
      await withMockApi(routes, async ({ apiUrl }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

        const program = new BaseCommand('netlify')
        // Disable process.exit() in command
        program.exitOverride()

        createSitesCreateCommand(program)

        await expect(async () => {
          await program.parseAsync(['', '', 'sites:create', '--name', Array.from({ length: 64 }).fill('a').join('')])
        }).rejects.toThrowError('--name should be less than 64 characters')
      })
    })
  })
})
