import process from 'process'

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

const routes = [
  {
    path: 'accounts',
    response: [{ slug: 'testAccount' }],
  },
  {
    path: 'sites',
    response: [{ name: 'mockSiteName' }],
  },
]

describe('sites:create-template', () => {
  beforeEach(async () => {
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
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')

      const stdoutwriteSpy = vi.spyOn(process.stdout, 'write')
      vi.mocked(deployedSiteExists).mockResolvedValue(true)

      createSitesFromTemplateCommand(program)

      program.parseAsync(['', '', 'sites:create-template', '--account-slug', 'test-account', '--name', 'test-name'])

      await new Promise((resolve) => {
        setTimeout(resolve, 2000)
      })

      expect(stdoutwriteSpy).toHaveBeenCalledWith('A site with that name already exists\n')
    })
  })

  test('it should ask for a new site name if site with that name already exists on account', async (t) => {
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')

      const stdoutwriteSpy = vi.spyOn(process.stdout, 'write')
      vi.mocked(deployedSiteExists).mockResolvedValue(false)

      createSitesFromTemplateCommand(program)

      program.parseAsync(['', '', 'sites:create-template', '--account-slug', 'test-account', '--name', 'mockSiteName'])

      await new Promise((resolve) => {
        setTimeout(resolve, 2000)
      })

      expect(stdoutwriteSpy).toHaveBeenCalledWith('A site with that name already exists on your account\n')
    })
  })

  test('it should only create a repo once even when prompting for new name input', async (t) => {
    const gitHubTestRoutes = [...routes, { path: 'test-account/sites', method: 'post', status: 422 }]

    vi.doMock('../../../../src/commands/sites/sites-create.ts', async () => {
      const actual = await vi.importActual('../../../../src/commands/sites/sites-create.ts')
      return {
        ...actual,
        getSiteNameInput: vi.fn().mockResolvedValue({ name: 'test-name' }),
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
        }, 2000)
      })

      expect(mockGetSiteNameInput).toHaveBeenCalled()
      expect(mockGetSiteNameInput).not.toHaveBeenCalledOnce()
      expect(createRepo).toHaveBeenCalledOnce()
    })
  })
})

// all with good pat:

// Y- perfectly fine name, unique no problems see that it works

// Y- globally existing name -> "a site with that name already exists" (z) AND prompt for new name

// Y- account existing name  -> "A site with that name already exists on your account" (one on ur account) AND prompt for new name

// Y- duplicate repo name that is a template name -> creates a repo with a uuid appended AND NOT prompt for new name

// Y- duplicate repo name that is not a template name -> `It seems you have already created a site with the name ${templateName}.` AND prmopt for new name

// Y- one of ben's non-deployed repo names -> 422, and create github repo with the name
// Y -  -- when you enter new unique name after this, should work and link to repo with original name
// aesthetic-gecko-b7dde3

// all with bad pat:
// perfectly fine unique name (global and account) -> 'could not create repository...' and NOT prompt for new name
