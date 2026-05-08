import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo, mockAgentSession } from './fixtures.js'

vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

describe('agents:follow-up command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should send a follow-up prompt and create a session', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/sessions',
        method: 'POST' as const,
        response: mockAgentSession,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const cliResponse = (await callCli(
          ['agents:follow-up', 'test_id', 'Also add tests'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('Follow-up session created!')
        expect(cliResponse).toContain('Task ID: test_id')
        expect(cliResponse).toContain('Session ID: session_id')
        expect(cliResponse).toContain('Prompt: Also add tests')

        const sessionRequest = requests.find((r) => r.path.endsWith('/sessions') && r.method === 'POST')
        expect(sessionRequest).toBeDefined()
        expect((sessionRequest?.body as { prompt: string }).prompt).toBe('Also add tests')
      })
    })
  })

  test('should accept prompt via --prompt flag', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/sessions',
        method: 'POST' as const,
        response: mockAgentSession,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        await callCli(
          ['agents:follow-up', 'test_id', '--prompt', 'Fix the lint error'],
          getCLIOptions({ apiUrl, builder }),
        )

        const sessionRequest = requests.find((r) => r.path.endsWith('/sessions') && r.method === 'POST')
        expect((sessionRequest?.body as { prompt: string }).prompt).toBe('Fix the lint error')
      })
    })
  })

  test('should pass agent and model in the request body', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/sessions',
        method: 'POST' as const,
        response: mockAgentSession,
      },
      {
        path: 'ai-gateway/providers',
        method: 'GET' as const,
        response: { providers: {} },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        await callCli(
          ['agents:follow-up', 'test_id', 'Update README', '--agent', 'claude', '--model', 'claude-3-sonnet'],
          getCLIOptions({ apiUrl, builder }),
        )

        const sessionRequest = requests.find((r) => r.path.endsWith('/sessions') && r.method === 'POST')
        expect(sessionRequest?.body).toMatchObject({
          prompt: 'Update README',
          agent: 'claude',
          model: 'claude-3-sonnet',
        })
      })
    })
  })

  test('should return JSON when --json flag is used', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/sessions',
        method: 'POST' as const,
        response: mockAgentSession,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:follow-up', 'test_id', 'Add tests', '--json'],
          getCLIOptions({ apiUrl, builder }),
          true,
        )) as typeof mockAgentSession

        expect(cliResponse).toEqual(mockAgentSession)
      })
    })
  })

  test('should reject prompts shorter than 5 chars', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:follow-up', 'test_id', 'no'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('more detailed prompt')
      })
    })
  })

  test('should surface "active session" hint on conflict', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/sessions',
        method: 'POST' as const,
        status: 409,
        response: { error: 'Cannot start: an active session is already running' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:follow-up', 'test_id', 'Add tests'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('Failed to send follow-up')
      })
    })
  })

  test('should require agent ID argument', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:follow-up'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'missing required argument',
        )
      })
    })
  })
})
