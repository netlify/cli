import process from 'process'

import inquirer from 'inquirer'
import { render } from 'prettyjson'
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.mjs'
import {
  createSitesFromTemplateCommand,
  fetchTemplates,
} from '../../../../src/commands/sites/sites-create-template.mjs'
import { createSitesCreateCommand } from '../../../../src/commands/sites/sites-create.mjs'
import { getGitHubToken } from '../../../../src/utils/init/config-github.mjs'
import { createRepo, getTemplatesFromGitHub } from '../../../../src/utils/sites/utils.mjs'
import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.cjs'

vi.mock('../../../../src/utils/command-helpers.mjs', async () => ({
  // @ts-expect-error No types yet for command-helpers
  ...(await vi.importActual('../../../../src/utils/command-helpers.mjs')),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  log: () => {},
}))

// mock the getGithubToken method with a fake token
vi.mock('../../../../src/utils/init/config-github.mjs', () => ({
  getGitHubToken: vi.fn().mockImplementation(() => 'my-token'),
}))

vi.mock('../../../../src/utils/sites/utils.mjs', () => ({
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
  createRepo: vi.fn().mockImplementation(() => ({
    full_name: 'Next starter',
    private: false,
    branch: 'main',
  })),
  validateTemplate: vi.fn().mockImplementation(() => ({
    exists: true,
    isTemplate: true,
  })),
}))

vi.mock('prettyjson', async () => {
  const realRender = (await vi.importActual('prettyjson')) as typeof import('prettyjson')

  return {
    ...realRender,
    render: vi.fn().mockImplementation((...args: Parameters<typeof realRender.render>) => realRender.render(...args)),
  }
})

vi.spyOn(inquirer, 'prompt').mockImplementation(() => Promise.resolve({ accountSlug: 'test-account' }))

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
  describe('sites:create-template', () => {
    test('basic', async () => {
      await withMockApi(routes, async ({ apiUrl }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

        const program = new BaseCommand('netlify')

        createSitesFromTemplateCommand(program)

        await program.parseAsync(['', '', 'sites:create-template'])
      })

      expect(getGitHubToken).toHaveBeenCalledOnce()
      expect(getTemplatesFromGitHub).toHaveBeenCalledOnce()
      expect(createRepo).toHaveBeenCalledOnce()
      expect(render).toHaveBeenCalledOnce()
      expect(render).toHaveBeenCalledWith({
        'Admin URL': siteInfo.admin_url,
        URL: siteInfo.ssl_url,
        'Site ID': siteInfo.id,
        'Repo URL': siteInfo.build_settings.repo_url,
      })
    })

    test('should not fetch templates if one is passed as option', async () => {
      await withMockApi(routes, async ({ apiUrl }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

        const program = new BaseCommand('netlify')

        createSitesFromTemplateCommand(program)

        await program.parseAsync([
          '',
          '',
          'sites:create-template',
          '-u',
          'http://github.com/netlify-templates/next-starter',
        ])

        expect(getTemplatesFromGitHub).not.toHaveBeenCalled()
      })
    })

    test('should throw an error if the URL option is not a valid URL', async () => {
      await withMockApi(routes, async ({ apiUrl }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

        const program = new BaseCommand('netlify')

        createSitesFromTemplateCommand(program)

        await expect(async () => {
          await program.parseAsync(['', '', 'sites:create-template', '-u', 'not-a-url'])
        }).rejects.toThrowError('Invalid URL')
      })
    })
  })

  describe('fetchTemplates', () => {
    test('should return an array of templates with name, source code url and slug', async () => {
      await withMockApi(routes, async ({ apiUrl }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

        const program = new BaseCommand('netlify')

        createSitesFromTemplateCommand(program)

        const templates = await fetchTemplates('fake-token')

        expect(getTemplatesFromGitHub).toHaveBeenCalledWith('fake-token')
        expect(templates).toEqual([
          {
            name: 'next-starter',
            sourceCodeUrl: 'http://github.com/netlify-templates/next-starter',
            slug: 'netlify-templates/next-starter',
          },
        ])
      })
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
