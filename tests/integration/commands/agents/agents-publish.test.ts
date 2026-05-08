import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo, mockAgentRunner } from './fixtures.js'

vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

describe('agents:publish command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should publish to production with --yes', async (t) => {
    const runnerWithCommit = { ...mockAgentRunner, merge_commit_sha: 'def5678' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/publish_to_production',
        method: 'POST' as const,
        response: runnerWithCommit,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:publish', 'test_id', '--yes'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Published agent task to production!')
        expect(cliResponse).toContain('Task ID: agent_runner_id')
        expect(cliResponse).toContain('Commit: def5678')
      })
    })
  })

  test('should refuse to publish without --yes when stdin is not a TTY', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:publish', 'test_id'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'Refusing to publish without --yes when stdin is not a TTY',
        )
      })
    })
  })

  test('should publish without --yes if --json is set (treats it as non-interactive)', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/publish_to_production',
        method: 'POST' as const,
        response: mockAgentRunner,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:publish', 'test_id', '--json'],
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
        path: 'agent_runners/test_id/publish_to_production',
        method: 'POST' as const,
        status: 500,
        response: { error: 'kaboom' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:publish', 'test_id', '--yes'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('Failed to publish: kaboom')
      })
    })
  })

  test('should require agent ID argument', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:publish'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'missing required argument',
        )
      })
    })
  })
})
