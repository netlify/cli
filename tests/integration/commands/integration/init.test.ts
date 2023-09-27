import {existsSync, readdirSync} from 'fs'
import {join} from 'path'

import { init as SdkInit } from '@netlify/sdk/commands'
import execa from 'execa'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { init } from '../../../../src/commands/integration/init.mjs'
import cliPath from '../../utils/cli-path.cjs'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.cjs'
import { withSiteBuilder } from '../../utils/site-builder.cjs'

vi.mock('@netlify/sdk/commands', () => ({
    init: vi.fn() }))

describe('integration:init', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })
  test('runs init method from sdk', async () => {

    await init({})

    expect(SdkInit).toHaveBeenCalled()

  })

  test('adds toml and yaml files', async () => {
    const routes = [
      { path: 'track', method: 'POST', response: {} },
      { path: 'sites', response: [] },
      { path: 'accounts', response: [] },
    ]

    await withSiteBuilder('mysite', async (builder) => {
      await builder.buildAsync()
      await withMockApi(routes, async ({ apiUrl }) => {

        await execa(cliPath, ['integration:init'], {
          ...getCLIOptions({apiUrl, builder}),
        })

        const yaml = join(builder.directory, 'integration.yaml')
        const toml = join(builder.directory, 'netlify.toml')

        console.log(builder.directory)
        expect(existsSync(yaml)).toBeTruthy()
        expect(existsSync(toml)).toBeTruthy()

      })
    })

  })

})

