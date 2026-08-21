import process from 'process'

import { afterAll, afterEach, beforeEach, describe, expect, test, vi, type MockInstance } from 'vitest'

import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.js'
import type { MinimalAccount } from '../../../../src/utils/types.js'
import { startSpinner } from '../../../../src/lib/spinner.js'

vi.mock('../../../../src/lib/spinner.js', async () => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const realStartSpinner = (await vi.importActual(
    '../../../../src/lib/spinner.js',
  )) as typeof import('../../../../src/lib/spinner.js')

  return {
    ...realStartSpinner,
    startSpinner: vi.fn(() => ({ stop: vi.fn(), error: vi.fn(), clear: vi.fn() })),
  }
})

const siteInfo = {
  account_slug: 'test-account',
  id: 'site_id',
  name: 'site-name',
  admin_url: 'https://app.netlify.com/projects/test-site/overview',
  url: 'https://test-site.netlify.app/',
  ssl_url: 'https://test-site.netlify.app/',
}

const user = { full_name: 'Test User', email: 'test@netlify.com' }

const accounts: MinimalAccount[] = [
  {
    id: 'user-id',
    name: user.full_name,
    slug: siteInfo.account_slug,
    default: true,
    team_logo_url: null,
    on_pro_trial: false,
    organization_id: null,
    type_name: 'placeholder',
    type_slug: 'placeholder',
    members_count: 1,
  },
]

const routes = [
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/builds', response: [] },
  { path: 'accounts', response: accounts },
]

const importModules = async () => {
  const { default: BaseCommand } = await import('../../../../src/commands/base-command.js')
  const { createWatchCommand } = await import('../../../../src/commands/watch/index.js')

  return { BaseCommand, createWatchCommand }
}

const OLD_ENV = process.env
const OLD_ARGV = process.argv

describe('watch command', () => {
  let stdoutSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    Object.defineProperty(process, 'env', { value: {} })
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
    process.argv = OLD_ARGV
    vi.resetModules()
  })

  afterAll(() => {
    vi.restoreAllMocks()
    Object.defineProperty(process, 'env', { value: OLD_ENV })
  })

  test('should start spinner when --silent flag is not passed', async () => {
    process.argv = ['node', 'netlify', 'watch']
    const { BaseCommand, createWatchCommand } = await importModules()

    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')
      createWatchCommand(program)
      await program.parseAsync(['', '', 'watch'])

      expect(startSpinner).toHaveBeenCalledOnce()
      expect(startSpinner).toHaveBeenCalledWith({ text: 'Waiting for active project deploys to complete' })
    })
  })

  test('should not start spinner when --silent flag is passed', async () => {
    process.argv = ['node', 'netlify', 'watch', '--silent']
    const { BaseCommand, createWatchCommand } = await importModules()

    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')
      createWatchCommand(program)
      await program.parseAsync(['', '', 'watch', '--silent'])

      expect(startSpinner).not.toHaveBeenCalled()
    })
  })

  test('should not print to stdout when --silent flag is passed', async () => {
    process.argv = ['node', 'netlify', 'watch', '--silent']
    const { BaseCommand, createWatchCommand } = await importModules()

    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')
      createWatchCommand(program)
      await program.parseAsync(['', '', 'watch', '--silent'])

      expect(stdoutSpy).not.toHaveBeenCalled()
    })
  })

  test('should allow output to stdout when --silent flag is not passed', async () => {
    process.argv = ['node', 'netlify', 'watch']
    const { BaseCommand, createWatchCommand } = await importModules()

    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')
      createWatchCommand(program)
      await program.parseAsync(['', '', 'watch'])

      expect(stdoutSpy).toHaveBeenCalledTimes(3)
    })
  })
})
