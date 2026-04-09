import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo, mockAgentRunner } from './fixtures.js'

// Mock spinner to avoid UI interference in tests
vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

describe('agents:stop command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should stop a running agent', async (t) => {
    const runningAgent = { ...mockAgentRunner, state: 'running' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        response: runningAgent,
      },
      {
        path: 'agent_runners/test_id',
        method: 'DELETE' as const,
        response: { success: true },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(['agents:stop', 'test_id'], getCLIOptions({ apiUrl, builder }))) as string

        expect(cliResponse).toContain('Agent task stopped successfully!')
        expect(cliResponse).toContain('Task ID: test_id')
        expect(cliResponse).toContain('Previous Status: RUNNING')
        expect(cliResponse).toContain('New Status: CANCELLED')
      })
    })
  })

  test('should handle already completed agent', async (t) => {
    const completedAgent = { ...mockAgentRunner, state: 'done' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        response: completedAgent,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(['agents:stop', 'test_id'], getCLIOptions({ apiUrl, builder }))) as string

        expect(cliResponse).toContain('Agent task is already completed')
      })
    })
  })

  test('should handle already cancelled agent', async (t) => {
    const cancelledAgent = { ...mockAgentRunner, state: 'cancelled' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        response: cancelledAgent,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(['agents:stop', 'test_id'], getCLIOptions({ apiUrl, builder }))) as string

        expect(cliResponse).toContain('Agent task is already cancelled')
      })
    })
  })

  test('should return JSON when --json flag is used', async (t) => {
    const runningAgent = { ...mockAgentRunner, state: 'running' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        response: runningAgent,
      },
      {
        path: 'agent_runners/test_id',
        method: 'DELETE' as const,
        response: { success: true },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:stop', 'test_id', '--json'],
          getCLIOptions({ apiUrl, builder }),
          true, // parseJson
        )) as { success: boolean }

        expect(cliResponse).toEqual({ success: true })
      })
    })
  })

  test('should handle agent not found', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/invalid_id',
        method: 'GET' as const,
        status: 404,
        response: { error: 'Not found' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(callCli(['agents:stop', 'invalid_id'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'Failed to stop agent task: Not found',
        )
      })
    })
  })

  test('should require agent ID argument', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:stop'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'missing required argument',
        )
      })
    })
  })

  test('should handle authentication errors', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        status: 401,
        response: { error: 'Unauthorized' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(callCli(['agents:stop', 'test_id'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'Failed to stop agent task: Unauthorized',
        )
      })
    })
  })

  test('should require linked site', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi([], async ({ apiUrl }) => {
        await expect(
          callCli(['agents:stop', 'test_id'], getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: undefined } })),
        ).rejects.toThrow("You don't appear to be in a folder that is linked to a project")
      })
    })
  })
})
