import { join } from 'path'
import process from 'process'

import execa from 'execa'
import { afterAll, beforeEach, afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

import { sitesCreateTemplate } from '../../../../src/commands/sites/sites-create-template.ts'
import { getGitHubToken } from '../../../../src/utils/init/config-github.ts'
import {
  getTemplatesFromGitHub,
  validateTemplate,
  deployedSiteExists,
  fetchTemplates,
  getTemplateName,
  createRepo,
} from '../../../../src/utils/sites/utils.ts'
import { cliPath } from '../../utils/cli-path.js'
import { handleQuestions, answerWithValue, DOWN } from '../../utils/handle-questions.js'
import { getCLIOptions, getEnvironmentVariables, startMockApi, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.ts'

import { sanityCheck } from './sanity'
import BaseCommand from '../../../../src/commands/base-command.ts'
import { createSitesFromTemplateCommand } from '../../../../src/commands/sites/sites.ts'
import { getSiteNameInput } from '../../../../src/commands/sites/sites-create.ts'

// import { log } from '../../../../src/utils/command-helpers.ts'
// const { stdout: cliResponse } = await childProcess
// First, mock the modules
// vi.mock('../../../../src/utils/gh-auth.ts')
vi.mock('../../../../src/utils/init/config-github.ts')
vi.mock('../../../../src/utils/sites/utils.ts')
vi.mock('../../../../src/commands/sites/sites-create.ts')
// vi.mock('../../../../src/commands/sites/sites-create-template.ts')

// https://www.bitovi.com/blog/more-mocks-mocking-modules-in-vitest

// vi.mock('../../../../src/commands/sites/sites-create-template.ts', async () => {
//   const actual = await vi.importActual('../../../../src/commands/sites/sites-create-template.ts')

//   return {
//     ...actual,
//     fetchTemplates: vi.fn().mockResolvedValue([
//       {
//         name: 'mockTemplateName',
//         sourceCodeUrl: 'mockUrl',
//         slug: 'mockSlug',
//       },
//     ]),
//     getTemplatesFromGitHub: vi.fn().mockResolvedValue([
//       {
//         name: 'mockTemplateName',
//         sourceCodeUrl: 'mockUrl',
//         slug: 'mockSlug',
//       },
//     ]),
//     getTemplateName: vi.fn().mockResolvedValue('mockTemplate'),
//     // getTemplateName: vi.fn().mockImplementation(() => 'mockTemplate'),
//     // Don't override sitesCreateTemplate - keep the real implementation
//   }
// })
// vi.mock('../../../../src/commands/sites/sites-create-template.ts', async (importActual) => {
//   const actual = await importActual()

//   return {
//     ...actual,
//     fetchTemplates: vi.fn().mockResolvedValue([
//       {
//         name: 'mockTemplateName',
//         sourceCodeUrl: 'mockUrl',
//         slug: 'mockSlug',
//       },
//     ]),
//     getTemplatesFromGitHub: vi.fn().mockResolvedValue([
//       {
//         name: 'mockTemplateName',
//         sourceCodeUrl: 'mockUrl',
//         slug: 'mockSlug',
//       },
//     ]),
//     getTemplateName: () => 'mockTemplate',
//     // getTemplateName: vi.fn().mockImplementation(() => 'mockTemplate'),
//     // Don't override sitesCreateTemplate - keep the real implementation
//   }
// })

// vi.mock('../../../../src/utils/sites/utils.ts', async (importActual) => {
//   const actual = await importActual()

//   return {
//     ...actual,
//     getTemplatesFromGitHub: vi.fn().mockResolvedValue([
//       {
//         name: 'mockTemplateName',
//         sourceCodeUrl: 'mockUrl',
//         slug: 'mockSlug',
//       },
//     ]),
//     validateTemplate: vi.fn().mockResolvedValue({ exists: true, isTemplate: true }),
//     // Don't override sitesCreateTemplate - keep the real implementation
//   }
// })

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

const gitHubTest = [...routes, { path: 'test-account/sites', method: 'post', status: 422 }]

describe('inputSiteName', () => {
  let mockApi
  let mockCommand
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
        name: 'mockTemplateName',
        sourceCodeUrl: 'mockUrl',
        slug: 'mockSlug',
      },
    ])
    vi.mocked(getGitHubToken).mockResolvedValue('mockTemplate')
    vi.mocked(getTemplateName).mockResolvedValue('mockTemplateName')

    vi.mocked(validateTemplate).mockResolvedValue({
      exists: true,
      isTemplate: true,
    })

    vi.mocked(createRepo).mockResolvedValue({
      id: 'mockId',
      full_name: 'mockName',
      private: true,
      default_branch: 'mockBranch',
    })
    // vi.mocked(getSiteNameInput).mockResolvedValue({ name: 'test-name' })
  })
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  test.only('it should ask for a new site name if site with that name already exists on a globally deployed site', async (t) => {
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')

      const stdoutwriteSpy = vi.spyOn(process.stdout, 'write')
      vi.mocked(deployedSiteExists).mockResolvedValue(true)

      createSitesFromTemplateCommand(program)

      program.parseAsync([
        '',
        '',
        'sites:create-template',
        '--account-slug',
        'mockSlug',
        '--name',
        'globallyExistingName',
      ])

      await new Promise((resolve) => {
        setTimeout(resolve, 2000)
      })

      expect(stdoutwriteSpy).toHaveBeenCalledWith('A site with that name already exists!!!!\n')
    })
  })

  test('it should ask for a new site name if site with that name already exists on account', async (t) => {
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')

      const stdoutwriteSpy = vi.spyOn(process.stdout, 'write')
      vi.mocked(deployedSiteExists).mockResolvedValue(false)

      createSitesFromTemplateCommand(program)

      program.parseAsync(['', '', 'sites:create-template', '--account-slug', 'slug', '--name', 'mockSiteName'])

      await new Promise((resolve) => {
        setTimeout(resolve, 2000)
      })

      expect(stdoutwriteSpy).toHaveBeenCalledWith('A site with that name already exists\n')
    })
  })

  test('no call github twice', async (t) => {
    await withMockApi(gitHubTest, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')

      vi.mocked(getSiteNameInput).mockResolvedValue({ name: 'test-name' })

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

      await new Promise((resolve) => {
        setTimeout(resolve, 250)
      })

      expect(getSiteNameInput).toHaveBeenCalled()
      expect(getSiteNameInput).not.toHaveBeenCalledOnce()
      expect(createRepo).toHaveBeenCalledOnce()
    })
  })
  // test('it should ask for a new site name if site with that name already exists on account', async (t) => {
  //   const stdoutwriteSpy = vi.spyOn(process.stdout, 'write')
  //   vi.mocked(deployedSiteExists).mockResolvedValue(false)
  //   sitesCreateTemplate('', { name: 'mockSiteName', accountSlug: 'mockSlug' }, mockCommand as any)

  //   await new Promise((resolve) => {
  //     setTimeout(resolve, 2000)
  //   })

  //   // expect(stdoutwriteSpy).toHaveBeenCalledWith('asdfsaf HERE!!!!!\n')
  //   expect(stdoutwriteSpy).toHaveBeenCalledWith('A site with that name already exists\n')
  // })

  // test('it should ask for a new site name if site with that name already exists on account', async (t) => {
  //   const stdoutwriteSpy = vi.spyOn(process.stdout, 'write')
  //   vi.mocked(deployedSiteExists).mockResolvedValue(false)
  //   sitesCreateTemplate('', { name: 'uniqueName', accountSlug: 'mockSlug' }, mockCommand as any)

  //   await new Promise((resolve) => {
  //     setTimeout(resolve, 2000)
  //   })

  //   // expect(stdoutwriteSpy).toHaveBeenCalledWith('asdfsaf HERE!!!!!\n')
  //   expect(stdoutwriteSpy).toHaveBeenCalledWith('Site name may already exist globally\n')
  // })

  // test('it should ask for a new site name if name already exists', async (t) => {
  //   const stdoutwriteSpy = vi.spyOn(process.stdout, 'write')

  //   sitesCreateTemplate('', { name: 'mockSiteName' }, mockCommand as any)

  //   console.log(stdoutwriteSpy.mock.calls)
  //   expect(stdoutwriteSpy).toHaveBeenCalledWith('A site with that name already exists\n')
  // })
})
