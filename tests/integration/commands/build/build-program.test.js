import process from 'process'

import { expect, beforeEach, afterAll, describe, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.ts'
import { createBuildCommand } from '../../../../src/commands/build/index.ts'
import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.ts'

let configOptions = {}

vi.mock('@netlify/config', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    resolveConfig: (options) => {
      configOptions = options
      return original.resolveConfig(options)
    },
  }
})

const siteInfo = {
  account_slug: 'test-account',
  id: 'site_id',
  name: 'site-name',
  feature_flags: { test_flag: true },
}
const routes = [
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  {
    path: 'accounts',
    response: [{ slug: siteInfo.account_slug }],
  },
]
// eslint-disable-next-line workspace/no-process-cwd
const originalCwd = process.cwd
const originalConsoleLog = console.log
const originalEnv = process.env

describe('command/build', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    configOptions = {}
    console.log = () => {}
  })

  afterAll(() => {
    // eslint-disable-next-line workspace/no-process-cwd
    process.cwd = originalCwd
    console.log = originalConsoleLog
    process.env = originalEnv

    vi.resetModules()
    vi.restoreAllMocks()
  })

  test('should pass feature flags to @netlify/config', async (t) => {
    // this ensures that the process.exit does not exit the test process
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      expect(code).toBe(0)
    })
    await withSiteBuilder(t, async (builder) => {
      // eslint-disable-next-line workspace/no-process-cwd
      process.cwd = () => builder.directory
      await withMockApi(routes, async ({ apiUrl }) => {
        process.env = getEnvironmentVariables({ apiUrl })

        await builder.withNetlifyToml({ config: {} }).withStateFile({ siteId: siteInfo.id }).build()

        const program = createBuildCommand(new BaseCommand('netlify'))

        await program.parseAsync(['', '', 'build'])
        expect(configOptions.featureFlags).toEqual(siteInfo.feature_flags)

        await program.parseAsync(['', '', 'build', '--offline'])
        expect(configOptions.featureFlags, 'should not call API in offline mode').toEqual({})
      })
    })
  })
})
