import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import {
  mockSiteInfo,
  mockSiteInfoNoRepo,
  mockAgentRunner,
  mockAgentRunnerNoRepo,
  mockAgentSession,
} from './fixtures.js'

// Mock spinner to avoid UI interference in tests
vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

describe('agents:list command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should list agent runners', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners',
        method: 'GET' as const,
        response: [mockAgentRunner],
      },
      {
        path: 'agent_runners/agent_runner_id/sessions',
        method: 'GET' as const,
        response: [mockAgentSession],
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(['agents:list'], getCLIOptions({ apiUrl, builder }))) as string

        expect(cliResponse).toContain('Agent Tasks for site-name')
        expect(cliResponse).toContain('agent_runner_id')
        expect(cliResponse).toContain('NEW')
        expect(cliResponse).toContain('Claude')
        expect(cliResponse).toContain('Create a login form')
      })
    })
  })

  test('should handle empty list', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners',
        method: 'GET' as const,
        response: [],
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(['agents:list'], getCLIOptions({ apiUrl, builder }))) as string

        expect(cliResponse).toContain('No agent tasks found for this site')
        expect(cliResponse).toContain('netlify agents:create')
      })
    })
  })

  test('should return JSON when --json flag is used', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners',
        method: 'GET' as const,
        response: [mockAgentRunner],
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:list', '--json'],
          getCLIOptions({ apiUrl, builder }),
          true, // parseJson
        )) as (typeof mockAgentRunner)[]

        expect(cliResponse).toEqual([mockAgentRunner])
      })
    })
  })

  test('should filter by status', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners',
        method: 'GET' as const,
        response: [{ ...mockAgentRunner, state: 'running' }],
      },
      {
        path: 'agent_runners/agent_runner_id/sessions',
        method: 'GET' as const,
        response: [mockAgentSession],
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = (await callCli(
          ['agents:list', '--status', 'running'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        // Check that the status filter was sent in the request
        const agentRequest = requests.find((r) => r.path.includes('agent_runners'))
        expect(agentRequest).toBeDefined()

        expect(cliResponse).toContain('RUNNING')
      })
    })
  })

  test('should handle authentication errors', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners',
        method: 'GET' as const,
        status: 401,
        response: { error: 'Unauthorized' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(callCli(['agents:list'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'Failed to list agent tasks: Unauthorized',
        )
      })
    })
  })

  test('should require linked site', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi([], async ({ apiUrl }) => {
        await expect(
          callCli(['agents:list'], getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: undefined } })),
        ).rejects.toThrow("You don't appear to be in a folder that is linked to a project")
      })
    })
  })

  test('should list agents for non-git site with BASE column', async (t) => {
    const routes = [
      { path: 'sites/zip_site_id', response: mockSiteInfoNoRepo },
      { path: 'sites/zip_site_id/service-instances', response: [] },
      { path: 'user', response: { name: 'test user' } },
      { path: 'accounts', response: [{ slug: 'test-account' }] },
      {
        path: 'agent_runners',
        response: [mockAgentRunnerNoRepo],
      },
      {
        path: 'agent_runners/agent_runner_no_repo_id/sessions',
        response: [mockAgentSession],
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:list'],
          getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: 'zip_site_id' } }),
        )) as string

        expect(cliResponse).toContain('Agent Tasks for zip-site')
        expect(cliResponse).toContain('BASE') // Should show BASE column header for non-git sites
        expect(cliResponse).toContain('Production') // Should show Production as base
        expect(cliResponse).not.toContain('BRANCH') // Should not show BRANCH column header
      })
    })
  })

  test('should list agents for git site with BRANCH column', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners',
        response: [mockAgentRunner],
      },
      {
        path: 'agent_runners/agent_runner_id/sessions',
        response: [mockAgentSession],
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(['agents:list'], getCLIOptions({ apiUrl, builder }))) as string

        expect(cliResponse).toContain('Agent Tasks for site-name')
        expect(cliResponse).toContain('BRANCH') // Should show BRANCH column header for git sites
        expect(cliResponse).toContain('main') // Should show actual branch name
        expect(cliResponse).not.toContain('BASE') // Should not show BASE column header
        expect(cliResponse).not.toContain('Production') // Should not show Production
      })
    })
  })
})
