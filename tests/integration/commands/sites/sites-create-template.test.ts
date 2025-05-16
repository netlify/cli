import process from 'process'

import inquirer from 'inquirer'
import { beforeEach, afterEach, describe, expect, test, vi, afterAll } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createSitesFromTemplateCommand } from '../../../../src/commands/sites/sites.js'
import { deployedSiteExists, fetchTemplates, getTemplateName } from '../../../../src/utils/sites/create-template.js'
import {
  getTemplatesFromGitHub,
  validateTemplate,
  createRepo,
  callLinkSite,
} from '../../../../src/utils/sites/utils.js'
import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.js'
import { chalk } from '../../../../src/utils/command-helpers.js'

vi.mock('../../../../src/utils/init/config-github.ts')
vi.mock('../../../../src/utils/sites/utils.ts')
vi.mock('../../../../src/utils/sites/create-template.ts')
vi.mock('inquirer')

inquirer.registerPrompt = vi.fn()
inquirer.prompt.registerPrompt = vi.fn()

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
    response: [{ name: 'test-name' }],
  },
  {
    path: 'test-account/sites',
    response: siteInfo,
    method: 'POST' as const,
  },
]

const OLD_ENV = process.env

describe('sites:create-template', () => {
  beforeEach(async () => {
    inquirer.prompt = Object.assign(
      vi
        .fn()
        .mockImplementationOnce(() => Promise.resolve({ accountSlug: 'test-account' }))
        .mockImplementationOnce(() => Promise.resolve({ name: 'test-name' }))
        .mockImplementationOnce(() => Promise.resolve({ cloneConfirm: true }))
        .mockImplementationOnce(() => Promise.resolve({ linkConfirm: true })),
      {
        prompts: inquirer.prompt?.prompts || {},
        registerPrompt: inquirer.prompt?.registerPrompt || vi.fn(),
        restoreDefaultPrompts: inquirer.prompt?.restoreDefaultPrompts || vi.fn(),
      },
    )

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
      name: 'repoName',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    vi.resetModules()
    vi.restoreAllMocks()

    Object.defineProperty(process, 'env', {
      value: OLD_ENV,
    })
  })

  test('it should ask for a new project name if project with that name already exists on a globally deployed project', async (t) => {
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
    expect(stdoutwriteSpy).toHaveBeenCalledWith('A project with that name already exists\n')
  })

  test('it should ask for a new project name if project with that name already exists on account', async (t) => {
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
    expect(stdoutwriteSpy).toHaveBeenCalledWith('A project with that name already exists on your account\n')
  })

  test('it should automatically link to the project when the user clones the template repo', async (t) => {
    const mockSuccessfulLinkOutput = `
      Directory Linked

      Admin url: https://app.netlify.com/projects/site-name
      Project url:  https://site-name.netlify.app

      You can now run other \`netlify\` cli commands in this directory
      `
    vi.mocked(callLinkSite).mockImplementationOnce(() => Promise.resolve(mockSuccessfulLinkOutput))

    const autoLinkRoutes = [
      {
        path: 'accounts',
        response: [{ slug: 'test-account' }],
      },
      {
        path: 'sites',
        response: [{ name: 'test-name-unique' }],
      },
      {
        path: 'test-account/sites',
        response: siteInfo,
        method: 'POST' as const,
      },
    ]

    const stdoutwriteSpy = vi.spyOn(process.stdout, 'write')
    await withMockApi(autoLinkRoutes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')

      vi.mocked(deployedSiteExists).mockResolvedValue(false)

      createSitesFromTemplateCommand(program)

      await program.parseAsync(['', '', 'sites:create-template'])
    })

    expect(stdoutwriteSpy).toHaveBeenCalledWith(
      `\nDirectory ${chalk.cyanBright('repoName')} linked to project ${chalk.cyanBright(
        'https://site-name.netlify.app',
      )}\n\n`,
    )
  })

  test('it should output instructions if a project is already linked', async (t) => {
    const mockUnsuccessfulLinkOutput = `
      Project already linked to \"site-name\"
      Admin url: https://app.netlify.com/projects/site-name

      To unlink this project, run: netlify unlink
      `

    vi.mocked(callLinkSite).mockImplementationOnce(() => Promise.resolve(mockUnsuccessfulLinkOutput))

    const autoLinkRoutes = [
      {
        path: 'accounts',
        response: [{ slug: 'test-account' }],
      },
      {
        path: 'sites',
        response: [{ name: 'test-name-unique' }],
      },
      {
        path: 'test-account/sites',
        response: siteInfo,
        method: 'POST' as const,
      },
    ]

    const stdoutwriteSpy = vi.spyOn(process.stdout, 'write')
    await withMockApi(autoLinkRoutes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')

      vi.mocked(deployedSiteExists).mockResolvedValue(false)

      createSitesFromTemplateCommand(program)

      await program.parseAsync(['', '', 'sites:create-template'])
    })

    expect(stdoutwriteSpy).toHaveBeenCalledWith(
      `\nThis directory appears to be linked to ${chalk.cyanBright(`"site-name"`)}\n`,
    )
  })
})
