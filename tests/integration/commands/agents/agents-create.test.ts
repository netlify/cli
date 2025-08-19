import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo, mockAgentRunner } from './fixtures.js'

// Mock inquirer for interactive prompts
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}))

// Mock spinner to avoid UI interference in tests
vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

describe('agents:create command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should create agent with all required parameters', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners',
        method: 'POST' as const,
        response: mockAgentRunner,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:create', 'Create a login form', '--agent', 'claude', '--branch', 'main'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Agent task created successfully!')
        expect(cliResponse).toContain('Task ID: agent_runner_id')
        expect(cliResponse).toContain('Prompt: Create a login form')
        expect(cliResponse).toContain('Agent: Claude')
        expect(cliResponse).toContain('Branch: main')
      })
    })
  })

  test('should return JSON when --json flag is used', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners',
        method: 'POST' as const,
        response: mockAgentRunner,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:create', 'Create a form', '--agent', 'claude', '--json'],
          getCLIOptions({ apiUrl, builder }),
          true, // parseJson
        )) as typeof mockAgentRunner

        expect(cliResponse).toEqual(mockAgentRunner)
      })
    })
  })

  test.todo('should handle interactive mode when no prompt provided')

  test('should validate prompt input', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(
          callCli(
            ['agents:create', 'hi'], // Too short prompt
            getCLIOptions({ apiUrl, builder }),
          ),
        ).rejects.toThrow('Please provide a more detailed prompt')
      })
    })
  })

  test('should validate agent type', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:create', 'Create a form', '--agent', 'invalid-agent'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('Invalid agent')
      })
    })
  })

  test('should handle authentication errors', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners',
        method: 'POST' as const,
        status: 401,
        response: { error: 'Unauthorized' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:create', 'Create a form', '--agent', 'claude'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('Failed to create agent task: Unauthorized')
      })
    })
  })

  test('should require linked site or project flag', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi([], async ({ apiUrl }) => {
        await expect(
          callCli(
            ['agents:create', 'Create a form', '--agent', 'claude'],
            getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: undefined } }),
          ),
        ).rejects.toThrow("You don't appear to be in a folder that is linked to a project")
      })
    })
  })
})
