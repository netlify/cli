import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo, mockAgentRunner } from './fixtures.js'

vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

describe('agents:commit command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should commit to a branch', async (t) => {
    const runnerWithCommit = { ...mockAgentRunner, merge_commit_sha: 'abc1234' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/commit',
        method: 'POST' as const,
        response: runnerWithCommit,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = (await callCli(
          ['agents:commit', 'test_id', '--branch', 'staging'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Committed to')
        expect(cliResponse).toContain('staging')
        expect(cliResponse).toContain('SHA: abc1234')

        const commitRequest = requests.find((r) => r.path.endsWith('/commit') && r.method === 'POST')
        expect(commitRequest).toBeDefined()
        expect(commitRequest?.body).toEqual({ target_branch: 'staging' })
      })
    })
  })

  test('should report merge_commit_error when commit fails on the server', async (t) => {
    const runnerWithError = { ...mockAgentRunner, merge_commit_error: 'merge conflict' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/commit',
        method: 'POST' as const,
        response: runnerWithError,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:commit', 'test_id', '--branch', 'staging'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Commit failed: merge conflict')
      })
    })
  })

  test('should return JSON when --json flag is used', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/commit',
        method: 'POST' as const,
        response: { ...mockAgentRunner, merge_commit_sha: 'abc1234' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:commit', 'test_id', '--branch', 'staging', '--json'],
          getCLIOptions({ apiUrl, builder }),
          true,
        )) as typeof mockAgentRunner & { merge_commit_sha: string }

        expect(cliResponse.merge_commit_sha).toBe('abc1234')
      })
    })
  })

  test('should handle API errors', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/commit',
        method: 'POST' as const,
        status: 500,
        response: { error: 'Internal error' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:commit', 'test_id', '--branch', 'staging'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('Failed to commit: Internal error')
      })
    })
  })

  test('should require --branch when stdin is not a TTY', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:commit', 'test_id'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          '--branch is required when stdin is not a TTY',
        )
      })
    })
  })

  test('should require agent ID argument', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:commit'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'missing required argument',
        )
      })
    })
  })
})
