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

    test('should output JSON when --json flag is passed', async () => {
      await withMockApi(routes, async ({ apiUrl }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

        const program = new BaseCommand('netlify')
        createSitesCreateCommand(program)

        const logJsonSpy = vi.spyOn(await import('../../../../src/utils/command-helpers.js'), 'logJson')

        await program.parseAsync([
          '',
          '',
          'sites:create',
          '--name',
          'test-site',
          '--account-slug',
          'test-account',
          '--disable-linking',
          '--json',
        ])

        expect(logJsonSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'site_id',
            name: 'site-name',
            admin_url: 'https://app.netlify.com/projects/site-name/overview',
            ssl_url: 'https://site-name.netlify.app/',
          }),
        )

        logJsonSpy.mockRestore()
      })
    })

    test('should fail after max retries in non-interactive mode', async () => {
      const routesWithPersistentConflict = [
        {
          path: 'accounts',
          response: [{ slug: 'test-account' }],
        },
        {
          path: 'sites',
          response: [],
        },
        {
          path: 'user',
          response: { name: 'test user', slug: 'test-user', email: 'user@test.com' },
        },
        {
          path: 'test-account/sites',
          method: 'POST' as const,
          status: 422,
          response: { message: 'site name already exists' },
        },
      ]

      await withMockApi(routesWithPersistentConflict, async ({ apiUrl, requests }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

        const program = new BaseCommand('netlify')
        program.exitOverride()
        createSitesCreateCommand(program)

        const warnSpy = vi.spyOn(await import('../../../../src/utils/command-helpers.js'), 'warn')

        await expect(async () => {
          await program.parseAsync([
            '',
            '',
            'sites:create',
            '--name',
            'taken-site',
            '--account-slug',
            'test-account',
            '--disable-linking',
          ])
        }).rejects.toThrowError(/already taken/)

        const siteCreateRequests = requests.filter(
          (r) => r.path === '/api/v1/test-account/sites' && r.method === 'POST',
        )
        expect(siteCreateRequests).toHaveLength(3)

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('taken-site.netlify.app already exists'))
        expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/Trying taken-site-\d{3}\.\.\./))

        warnSpy.mockRestore()
      })
    })
  })
})
