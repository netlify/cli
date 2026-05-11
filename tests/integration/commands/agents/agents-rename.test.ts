import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo, mockAgentRunner } from './fixtures.js'

vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

describe('agents:rename command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should rename an agent task', async (t) => {
    const renamed = { ...mockAgentRunner, title: 'New title' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'PATCH' as const,
        response: renamed,
        validateRequest: (request: { body: string }) => {
          const body = JSON.parse(request.body) as { title: string }
          expect(body.title).toBe('New title')
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:rename', 'test_id', 'New title'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Agent task renamed.')
        expect(cliResponse).toContain('Title: New title')
      })
    })
  })

  test('should trim whitespace from the title', async (t) => {
    const renamed = { ...mockAgentRunner, title: 'Trimmed title' }
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'PATCH' as const,
        response: renamed,
        validateRequest: (request: { body: string }) => {
          const body = JSON.parse(request.body) as { title: string }
          expect(body.title).toBe('Trimmed title')
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:rename', 'test_id', '  Trimmed title  '],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Title: Trimmed title')
      })
    })
  })

  test('should reject empty titles', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:rename', 'test_id', '   '], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'A non-empty title is required',
        )
      })
    })
  })

  test('should surface 404 when the task is missing', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/missing_id',
        method: 'PATCH' as const,
        status: 404,
        response: { error: 'Not found' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:rename', 'missing_id', 'Title'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('Agent task not found: missing_id')
      })
    })
  })
})
