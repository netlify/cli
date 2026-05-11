import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo, mockAgentRunner } from './fixtures.js'

vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

describe('agents:sync command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should rebase when only rebase is available', async (t) => {
    const runner = { ...mockAgentRunner, rebase_available: true }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        response: runner,
      },
      {
        path: 'agent_runners/test_id/rebase',
        method: 'POST' as const,
        response: runner,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = (await callCli(
          ['agents:sync', 'test_id', '--yes'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Sync started')
        expect(cliResponse).toContain('reapply changes on top of the latest production deploy')
        const syncRequest = requests.find((r) => r.path.endsWith('/rebase'))
        expect(syncRequest).toBeDefined()
      })
    })
  })

  test('should merge target when merge_target is available', async (t) => {
    const runner = { ...mockAgentRunner, merge_target_available: true, rebase_available: true }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        response: runner,
      },
      {
        path: 'agent_runners/test_id/merge_target',
        method: 'POST' as const,
        response: runner,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = (await callCli(
          ['agents:sync', 'test_id', '--yes'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('merge the latest target branch')
        const mergeRequest = requests.find((r) => r.path.endsWith('/merge_target'))
        expect(mergeRequest).toBeDefined()
      })
    })
  })

  test('should sync git origin when needs_git_sync is set', async (t) => {
    const runner = { ...mockAgentRunner, needs_git_sync: true, rebase_available: true, merge_target_available: true }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        response: runner,
      },
      {
        path: 'agent_runners/test_id/sync_git_origin',
        method: 'POST' as const,
        response: runner,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = (await callCli(
          ['agents:sync', 'test_id', '--yes'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('sync with the remote git origin')
        const syncRequest = requests.find((r) => r.path.endsWith('/sync_git_origin'))
        expect(syncRequest).toBeDefined()
      })
    })
  })

  test('should report when nothing needs syncing', async (t) => {
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
          ['agents:sync', 'test_id', '--yes'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Nothing to sync')
      })
    })
  })

  test('should surface 404 when the task is missing', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/missing_id',
        method: 'GET' as const,
        status: 404,
        response: { error: 'Not found' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:sync', 'missing_id', '--yes'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('Agent task not found: missing_id')
      })
    })
  })
})
