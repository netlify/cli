import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo } from './fixtures.js'

vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

describe('agents:archive command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should archive an agent task with --yes', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/archive',
        method: 'POST' as const,
        response: {},
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:archive', 'test_id', '--yes'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Agent task archived.')
        expect(cliResponse).toContain('Task ID: test_id')
      })
    })
  })

  test('should refuse to archive without --yes when stdin is not a TTY', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:archive', 'test_id'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'Refusing to archive without --yes when stdin is not a TTY',
        )
      })
    })
  })

  test('should return JSON when --json flag is used', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/archive',
        method: 'POST' as const,
        response: {},
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:archive', 'test_id', '--json'],
          getCLIOptions({ apiUrl, builder }),
          true,
        )) as { success: boolean; id: string }

        expect(cliResponse).toEqual({ success: true, id: 'test_id' })
      })
    })
  })

  test('should handle archive failure when the task is missing', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/archive',
        method: 'POST' as const,
        status: 404,
        response: { error: 'Not found' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:archive', 'test_id', '--yes'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('Agent task not found: test_id')
      })
    })
  })

  test('should surface other archive failures generically', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/archive',
        method: 'POST' as const,
        status: 500,
        response: { error: 'something exploded' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:archive', 'test_id', '--yes'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('Failed to archive: something exploded')
      })
    })
  })

  test('should require agent ID argument', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:archive'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'missing required argument',
        )
      })
    })
  })

  test('should require linked site', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi([], async ({ apiUrl }) => {
        await expect(
          callCli(
            ['agents:archive', 'test_id', '--yes'],
            getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: undefined } }),
          ),
        ).rejects.toThrow("You don't appear to be in a folder that is linked to a project")
      })
    })
  })
})
