import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo, mockAgentRunner } from './fixtures.js'

vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

describe('agents:open command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  const noBrowserEnv = { BROWSER: 'none' }

  test('should open the deploy preview URL for a task', async (t) => {
    const runnerWithPreview = { ...mockAgentRunner, latest_session_deploy_url: 'https://preview.netlify.app' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        response: runnerWithPreview,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:open', 'test_id'],
          getCLIOptions({ apiUrl, builder, env: noBrowserEnv }),
        )) as string

        expect(cliResponse).toContain('Opening')
        expect(cliResponse).toContain('https://preview.netlify.app')
      })
    })
  })

  test('should fall back to dashboard when no preview is available', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        response: mockAgentRunner,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:open', 'test_id'],
          getCLIOptions({ apiUrl, builder, env: noBrowserEnv }),
        )) as string

        expect(cliResponse).toContain('No deploy preview available')
        expect(cliResponse).toContain('app.netlify.com/projects/site-name/agent-runs/test_id')
      })
    })
  })

  test('should open the dashboard when target is "dashboard"', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:open', 'test_id', 'dashboard'],
          getCLIOptions({ apiUrl, builder, env: noBrowserEnv }),
        )) as string

        expect(cliResponse).toContain('app.netlify.com/projects/site-name/agent-runs/test_id')
      })
    })
  })

  test('should open the PR url when target is "pr"', async (t) => {
    const runnerWithPr = { ...mockAgentRunner, pr_url: 'https://github.com/owner/repo/pull/42' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        response: runnerWithPr,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:open', 'test_id', 'pr'],
          getCLIOptions({ apiUrl, builder, env: noBrowserEnv }),
        )) as string

        expect(cliResponse).toContain('https://github.com/owner/repo/pull/42')
      })
    })
  })

  test('should explain when no PR exists yet', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        response: mockAgentRunner,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:open', 'test_id', 'pr'],
          getCLIOptions({ apiUrl, builder, env: noBrowserEnv }),
        )) as string

        expect(cliResponse).toContain('No pull request exists for this agent task')
        expect(cliResponse).toContain('netlify agents:pr test_id')
      })
    })
  })

  test('should reject invalid targets', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:open', 'test_id', 'whatever'], getCLIOptions({ apiUrl, builder, env: noBrowserEnv })),
        ).rejects.toThrow('Invalid target "whatever"')
      })
    })
  })

  test('should require agent ID argument', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:open'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'missing required argument',
        )
      })
    })
  })
})
