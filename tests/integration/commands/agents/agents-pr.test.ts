import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo, mockAgentRunner } from './fixtures.js'

vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

describe('agents:pr command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should create a pull request', async (t) => {
    const runnerWithPr = {
      ...mockAgentRunner,
      pr_url: 'https://github.com/owner/repo/pull/42',
      pr_branch: 'agent/abc',
      pr_state: 'open',
    }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/pull_request',
        method: 'POST' as const,
        response: runnerWithPr,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(['agents:pr', 'test_id'], getCLIOptions({ apiUrl, builder }))) as string

        expect(cliResponse).toContain('Pull request created!')
        expect(cliResponse).toContain('https://github.com/owner/repo/pull/42')
        expect(cliResponse).toContain('Branch: agent/abc')
        expect(cliResponse).toContain('State: open')
      })
    })
  })

  test('should report pr_error returned by the API', async (t) => {
    const runnerWithError = { ...mockAgentRunner, pr_error: 'no diff to base on' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/pull_request',
        method: 'POST' as const,
        response: runnerWithError,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(['agents:pr', 'test_id'], getCLIOptions({ apiUrl, builder }))) as string

        expect(cliResponse).toContain('Pull request failed: no diff to base on')
      })
    })
  })

  test('should return JSON when --json flag is used', async (t) => {
    const runnerWithPr = { ...mockAgentRunner, pr_url: 'https://github.com/owner/repo/pull/42' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/pull_request',
        method: 'POST' as const,
        response: runnerWithPr,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:pr', 'test_id', '--json'],
          getCLIOptions({ apiUrl, builder }),
          true,
        )) as typeof mockAgentRunner & { pr_url: string }

        expect(cliResponse.pr_url).toBe('https://github.com/owner/repo/pull/42')
      })
    })
  })

  test('should handle API errors', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/pull_request',
        method: 'POST' as const,
        status: 500,
        response: { error: 'something went wrong' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(callCli(['agents:pr', 'test_id'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'Failed to create pull request: something went wrong',
        )
      })
    })
  })

  test('should require agent ID argument', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:pr'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'missing required argument',
        )
      })
    })
  })
})
