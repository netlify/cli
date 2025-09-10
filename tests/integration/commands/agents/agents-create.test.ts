import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo, mockSiteInfoNoRepo, mockAgentRunner, mockAgentRunnerNoRepo } from './fixtures.js'

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

  test('should create agent for non-git site without branch', async (t) => {
    const routes = [
      { path: 'sites/zip_site_id', response: mockSiteInfoNoRepo },
      { path: 'sites/zip_site_id/service-instances', response: [] },
      { path: 'user', response: { name: 'test user' } },
      { path: 'accounts', response: [{ slug: 'test-account' }] },
      {
        path: 'agent_runners',
        method: 'POST' as const,
        response: mockAgentRunnerNoRepo,
        // Verify that no branch is sent in the request
        validateRequest: (request: { body: string }) => {
          const body = JSON.parse(request.body) as { prompt: string; branch?: string }
          expect(body).not.toHaveProperty('branch')
          expect(body.prompt).toBe('Add a contact form')
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:create', 'Add a contact form', '--agent', 'claude'],
          getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: 'zip_site_id' } }),
        )) as string

        expect(cliResponse).toContain('Agent task created successfully!')
        expect(cliResponse).toContain('Task ID: agent_runner_no_repo_id')
        expect(cliResponse).toContain('Prompt: Add a contact form')
        expect(cliResponse).toContain('Agent: Claude')
        expect(cliResponse).toContain('Base: Latest production deployment')
        expect(cliResponse).not.toContain('Branch:')
      })
    })
  })

  test('should create agent for git site with branch', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners',
        method: 'POST' as const,
        response: mockAgentRunner,
        // Verify that branch is sent in the request
        validateRequest: (request: { body: string }) => {
          const body = JSON.parse(request.body) as { prompt: string; branch: string }
          expect(body.branch).toBe('feature-branch')
          expect(body.prompt).toBe('Create a dashboard')
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:create', 'Create a dashboard', '--agent', 'claude', '--branch', 'feature-branch'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Agent task created successfully!')
        expect(cliResponse).toContain('Branch: main') // Mock returns main branch
        expect(cliResponse).not.toContain('Base: Latest production deployment')
      })
    })
  })

  test('should prompt for branch when none provided for git site', async (t) => {
    const inquirer = await import('inquirer')

    // Mock the branch input prompt
    vi.mocked(inquirer.default.prompt).mockResolvedValue({ branchInput: 'develop' })

    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners',
        method: 'POST' as const,
        response: { ...mockAgentRunner, branch: 'develop' },
        validateRequest: (request: { body: string }) => {
          const body = JSON.parse(request.body) as { branch: string }
          expect(body.branch).toBe('develop')
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:create', 'Create a form', '--agent', 'claude'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(inquirer.default.prompt).toHaveBeenCalledWith([
          expect.objectContaining({
            name: 'branchInput',
            message: 'Which branch would you like to work on?',
            default: 'main', // Should use repo default
          }),
        ])

        expect(cliResponse).toContain('Branch: develop')
      })
    })
  })
})
