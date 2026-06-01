import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo, mockAgentRunner } from './fixtures.js'

vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

describe('agents:revert command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should revert to a session with --yes', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/revert',
        method: 'POST' as const,
        response: mockAgentRunner,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = (await callCli(
          ['agents:revert', 'test_id', '--session', 'session_id', '--yes'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Agent run reverted!')
        expect(cliResponse).toContain('Reverted to session: session_id')

        const revertRequest = requests.find((r) => r.path.endsWith('/revert') && r.method === 'POST')
        expect(revertRequest?.body).toEqual({ session_id: 'session_id' })
      })
    })
  })

  test('should refuse to revert without --yes when stdin is not a TTY', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:revert', 'test_id', '--session', 'session_id'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('Refusing to revert without --yes when stdin is not a TTY')
      })
    })
  })

  test('should require --session', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:revert', 'test_id', '--yes'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow(/required option.*--session/)
      })
    })
  })

  test('should return JSON when --json flag is used', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/revert',
        method: 'POST' as const,
        response: mockAgentRunner,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:revert', 'test_id', '--session', 'session_id', '--json'],
          getCLIOptions({ apiUrl, builder }),
          true,
        )) as typeof mockAgentRunner

        expect(cliResponse).toEqual(mockAgentRunner)
      })
    })
  })

  test('should handle API errors', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/revert',
        method: 'POST' as const,
        status: 500,
        response: { error: 'broken' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:revert', 'test_id', '--session', 'session_id', '--yes'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('Failed to revert: broken')
      })
    })
  })

  test('should require agent ID argument', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:revert', '--session', 'session_id'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('missing required argument')
      })
    })
  })
})
