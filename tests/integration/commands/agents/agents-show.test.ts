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

describe('agents:show command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should show agent runner details', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        response: mockAgentRunner,
      },
      {
        path: 'agent_runners/test_id/sessions',
        method: 'GET' as const,
        response: [mockAgentSession],
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(['agents:show', 'test_id'], getCLIOptions({ apiUrl, builder }))) as string

        expect(cliResponse).toContain('Agent Task Details')
        expect(cliResponse).toContain('Task ID: agent_runner_id')
        expect(cliResponse).toContain('Status: NEW')
        expect(cliResponse).toContain('Site: site-name')
        expect(cliResponse).toContain('Agent: Claude')
        expect(cliResponse).toContain('Branch: main')
        expect(cliResponse).toContain('Prompt: Create a login form')
      })
    })
  })

  test('should return JSON when --json flag is used', async (t) => {
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
          ['agents:show', 'test_id', '--json'],
          getCLIOptions({ apiUrl, builder }),
          true, // parseJson
        )) as typeof mockAgentRunner

        expect(cliResponse).toEqual(mockAgentRunner)
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
        await expect(callCli(['agents:show', 'invalid_id'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'Failed to show agent task: Not found',
        )
      })
    })
  })

  test('should require agent ID argument', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:show'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
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
        await expect(callCli(['agents:show', 'test_id'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'Failed to show agent task: Unauthorized',
        )
      })
    })
  })

  test('should require linked site', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi([], async ({ apiUrl }) => {
        await expect(
          callCli(['agents:show', 'test_id'], getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: undefined } })),
        ).rejects.toThrow("You don't appear to be in a folder that is linked to a project")
      })
    })
  })

  test('should show agent details for non-git site', async (t) => {
    const routes = [
      { path: 'sites/zip_site_id', response: mockSiteInfoNoRepo },
      { path: 'sites/zip_site_id/service-instances', response: [] },
      { path: 'user', response: { name: 'test user' } },
      { path: 'accounts', response: [{ slug: 'test-account' }] },
      {
        path: 'agent_runners/no_repo_test_id',
        response: mockAgentRunnerNoRepo,
      },
      {
        path: 'agent_runners/no_repo_test_id/sessions',
        response: [
          {
            ...mockAgentSession,
            agent_runner_id: 'agent_runner_no_repo_id',
          },
        ],
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:show', 'no_repo_test_id'],
          getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: 'zip_site_id' } }),
        )) as string

        expect(cliResponse).toContain('Agent Task Details')
        expect(cliResponse).toContain('Task ID: agent_runner_no_repo_id')
        expect(cliResponse).toContain('Base: Latest production deployment')
        expect(cliResponse).not.toContain('Branch:')
        expect(cliResponse).not.toContain('Result Branch:')
      })
    })
  })

  test('should show agent details for git site', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/git_test_id',
        response: mockAgentRunner,
      },
      {
        path: 'agent_runners/git_test_id/sessions',
        response: [mockAgentSession],
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:show', 'git_test_id'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Agent Task Details')
        expect(cliResponse).toContain('Task ID: agent_runner_id')
        expect(cliResponse).toContain('Branch: main')
        expect(cliResponse).not.toContain('Base: Latest production deployment')
      })
    })
  })
})
