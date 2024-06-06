import process from 'process'

import { expect, beforeEach, afterAll, describe, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.ts'
import { createBuildCommand } from '../../../../src/commands/build/index.ts'
import { getEnvironmentVariables } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.ts'
import { withMockApi } from '../../utils/mock-api.js'

let configOptions = {}

vi.mock('@netlify/config', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    resolveConfig: async (options) => {
      const config = await original.resolveConfig(options)
      configOptions = options
      return config
    },
  }
})

const siteInfo = {
  account_slug: 'test-account',
  id: 'site_id',
  name: 'site-name',
  feature_flags: { test_flag: true },
}
const siteInfoWithCommand = {
  ...siteInfo,
  build_settings: {
    cmd: 'echo uiCommand',
  },
}
const routes = [
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  {
    path: 'accounts',
    response: [{ slug: siteInfo.account_slug }],
  },
]
const routesWithCommand = [...routes]
routesWithCommand.splice(0, 1, { path: 'sites/site_id', response: siteInfoWithCommand })

// eslint-disable-next-line workspace/no-process-cwd
const originalCwd = process.cwd
const originalConsoleLog = console.log

const OLD_ENV = process.env

describe('command/build', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    configOptions = {}
    console.log = () => {}

    Object.defineProperty(process, 'env', { value: {} })
  })

  afterAll(() => {
    // eslint-disable-next-line workspace/no-process-cwd
    process.cwd = originalCwd
    console.log = originalConsoleLog

    vi.resetModules()
    vi.restoreAllMocks()

    Object.defineProperty(process, 'env', {
      value: OLD_ENV,
    })
  })

  test('should pass feature flags to @netlify/config', async (t) => {
    // this ensures that the process.exit does not exit the test process
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      expect(code).toBe(0)
    })
    await withSiteBuilder(t, async (builder) => {
      // eslint-disable-next-line workspace/no-process-cwd
      process.cwd = () => builder.directory
      await withMockApi(routesWithCommand, async ({ apiUrl }) => {
        const env = getEnvironmentVariables({ apiUrl })
        Object.assign(process.env, env)

        builder.withNetlifyToml({ config: {} }).withStateFile({ siteId: siteInfo.id })

        await builder.build()

        const program = new BaseCommand('netlify')

        createBuildCommand(program)

        await program.parseAsync(['', '', 'build', '--offline'])

        expect(configOptions.featureFlags).toEqual(siteInfo.feature_flags)
      })
    })
  })
})
