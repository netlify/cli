import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo, mockAgentSession } from './fixtures.js'

vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

describe('agents:redeploy command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should redeploy a specific session', async (t) => {
    const newSession = { ...mockAgentSession, id: 'new_session_id', state: 'running' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/sessions/old_session_id/redeploy',
        method: 'POST' as const,
        response: newSession,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:redeploy', 'test_id', '--session', 'old_session_id'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Redeploy session created!')
        expect(cliResponse).toContain('Session ID: new_session_id')
        expect(cliResponse).toContain('Source Session: old_session_id')
      })
    })
  })

  test('should pick the latest done session when no --session is given', async (t) => {
    const completedSession = { ...mockAgentSession, id: 'done_session_id', state: 'done' }
    const newSession = { ...mockAgentSession, id: 'new_session_id', state: 'running' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/sessions',
        method: 'GET' as const,
        response: [completedSession],
      },
      {
        path: 'agent_runners/test_id/sessions/done_session_id/redeploy',
        method: 'POST' as const,
        response: newSession,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:redeploy', 'test_id'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Redeploy session created!')
        expect(cliResponse).toContain('Source Session: done_session_id')
      })
    })
  })

  test('should error when no completed session exists', async (t) => {
    const runningSession = { ...mockAgentSession, state: 'running' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/sessions',
        method: 'GET' as const,
        response: [runningSession],
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(callCli(['agents:redeploy', 'test_id'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'No completed session found to redeploy',
        )
      })
    })
  })

  test('should return JSON when --json flag is used', async (t) => {
    const newSession = { ...mockAgentSession, id: 'new_session_id' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/sessions/old_session_id/redeploy',
        method: 'POST' as const,
        response: newSession,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:redeploy', 'test_id', '--session', 'old_session_id', '--json'],
          getCLIOptions({ apiUrl, builder }),
          true,
        )) as typeof mockAgentSession

        expect(cliResponse).toEqual(newSession)
      })
    })
  })

  test('should handle API errors when redeploying', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/sessions/old_session_id/redeploy',
        method: 'POST' as const,
        status: 500,
        response: { error: 'oops' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:redeploy', 'test_id', '--session', 'old_session_id'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('Failed to redeploy: oops')
      })
    })
  })

  test('should require agent ID argument', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:redeploy'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'missing required argument',
        )
      })
    })
  })
})
