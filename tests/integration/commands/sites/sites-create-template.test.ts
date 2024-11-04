import process from 'process'

import inquirer from 'inquirer'
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.ts'
import { createSitesFromTemplateCommand } from '../../../../src/commands/sites/sites.ts'
import { deployedSiteExists, fetchTemplates, getTemplateName } from '../../../../src/utils/sites/create-template.ts'
import {
  getTemplatesFromGitHub,
  validateTemplate,
  createRepo,
  callLinkSite,
} from '../../../../src/utils/sites/utils.ts'
import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.js'
import { chalk } from '../../../../src/utils/command-helpers.ts'

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
      .mockImplementationOnce(() => Promise.resolve({ cloneConfirm: true }))
      .mockImplementationOnce(() => Promise.resolve({ linkConfirm: true }))
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

  test('it should automatically link to the site when the user clones the template repo', async (t) => {
    const mockSuccessfulLinkOutput = `
      Directory Linked

      Admin url: https://app.netlify.com/sites/site-name
      Site url:  https://site-name.netlify.app

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
        method: 'post',
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
      `\nDirectory ${chalk.cyanBright('repoName')} linked to site ${chalk.cyanBright(
        'https://site-name.netlify.app',
      )}\n\n`,
    )
  })

  test('it should output instructions if a site is already linked', async (t) => {
    const mockUnsuccessfulLinkOutput = `
      Site already linked to \"site-name\"
      Admin url: https://app.netlify.com/sites/site-name

      To unlink this site, run: netlify unlink
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
        method: 'post',
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
