import process from 'process'

import inquirer from 'inquirer'
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.ts'
import { createSitesFromTemplateCommand } from '../../../../src/commands/sites/sites.ts'
import { getGitHubToken } from '../../../../src/utils/init/config-github.ts'
import { deployedSiteExists, fetchTemplates, getTemplateName } from '../../../../src/utils/sites/create-template.ts'
import { getTemplatesFromGitHub, validateTemplate, createRepo } from '../../../../src/utils/sites/utils.ts'
import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.js'

vi.mock('../../../../src/utils/init/config-github.ts')
vi.mock('../../../../src/utils/sites/utils.ts')
vi.mock('../../../../src/utils/sites/create-template.ts')

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
    response: [{ name: 'test-name' }],
  },
  {
    path: 'test-account/sites',
    response: siteInfo,
    method: 'post',
  },
]

describe('sites:create-template', () => {
  beforeEach(async () => {
    vi.mock('inquirer')
    vi.mocked(inquirer.prompt)
      .mockImplementationOnce(() => Promise.resolve({ accountSlug: 'test-account' }))
      .mockImplementationOnce(() => Promise.resolve({ name: 'test-name' }))

    vi.mocked(getGitHubToken).mockResolvedValue('mockToken')
    vi.mocked(fetchTemplates).mockResolvedValue([
      {
        name: 'mockTemplateName',
        sourceCodeUrl: 'mockUrl',
        slug: 'mockSlug',
      },
    ])
    vi.mocked(getTemplatesFromGitHub).mockResolvedValue([
      {
        name: 'mock-name',
        html_url: 'mock-url',
        full_name: 'mock-full-name',
        archived: false,
        disabled: false,
      },
    ])
    vi.mocked(getGitHubToken).mockResolvedValue('mockTemplate')
    vi.mocked(getTemplateName).mockResolvedValue('mockTemplateName')

    vi.mocked(validateTemplate).mockResolvedValue({
      exists: true,
      isTemplate: true,
    })

    vi.mocked(createRepo).mockResolvedValue({
      id: 1,
      full_name: 'mockName',
      private: true,
      default_branch: 'mockBranch',
    })
  })
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  test('it should ask for a new site name if site with that name already exists on a globally deployed site', async (t) => {
    const stdoutwriteSpy = vi.spyOn(process.stdout, 'write')
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')

      vi.mocked(deployedSiteExists).mockResolvedValue(true)

      createSitesFromTemplateCommand(program)

      await program.parseAsync([
        '',
        '',
        'sites:create-template',
        '--account-slug',
        'test-account',
        '--name',
        'test-name',
      ])
    })
    expect(stdoutwriteSpy).toHaveBeenCalledWith('A site with that name already exists\n')
  })

  test('it should ask for a new site name if site with that name already exists on account', async (t) => {
    const stdoutwriteSpy = vi.spyOn(process.stdout, 'write')
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')

      vi.mocked(deployedSiteExists).mockResolvedValue(false)

      createSitesFromTemplateCommand(program)

      await program.parseAsync([
        '',
        '',
        'sites:create-template',
        '--account-slug',
        'test-account',
        '--name',
        'test-name',
      ])
    })
    expect(stdoutwriteSpy).toHaveBeenCalledWith('A site with that name already exists on your account\n')
  })

  test('it should only create a repo once even when prompting for new name input', async (t) => {
    const gitHubTestRoutes = [
      {
        path: 'accounts',
        response: [{ slug: 'test-account' }],
      },
      {
        path: 'sites',
        response: [{ name: 'test-name' }],
      },
      { path: 'test-account/sites', method: 'post', status: 422 },
    ]

    vi.doMock('../../../../src/commands/sites/sites-create.ts', async () => {
      const actual = await vi.importActual('../../../../src/commands/sites/sites-create.ts')
      return {
        ...actual,
        getSiteNameInput: vi.fn().mockResolvedValue({ name: 'uniqueSiteName' }),
      }
    })

    const { getSiteNameInput } = await import('../../../../src/commands/sites/sites-create.ts')
    const mockGetSiteNameInput = vi.mocked(getSiteNameInput)

    await withMockApi(gitHubTestRoutes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')

      createSitesFromTemplateCommand(program)

      program.parseAsync([
        '',
        '',
        'sites:create-template',
        '--account-slug',
        'test-account',
        '--name',
        'uniqueSiteName',
      ])

      await new Promise<void>((resolve, reject) => {
        const interval = setInterval(() => {
          if (mockGetSiteNameInput.mock.calls.length >= 2) {
            clearInterval(interval)
            resolve()
          }
        }, 1)

        setTimeout(() => {
          clearInterval(interval)
          resolve()
        }, 5000)
      })
    })
    expect(mockGetSiteNameInput).toHaveBeenCalled()
    expect(mockGetSiteNameInput).not.toHaveBeenCalledOnce()
    expect(createRepo).toHaveBeenCalledOnce()
  })
})
