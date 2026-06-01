import type express from 'express'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { mockSiteInfo } from './fixtures.js'

vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({ text: 'test' })),
  stopSpinner: vi.fn(),
}))

const SAMPLE_DIFF = `diff --git a/foo.txt b/foo.txt
index 0000000..1111111 100644
--- a/foo.txt
+++ b/foo.txt
@@ -1 +1 @@
-old
+new
`

describe('agents:diff command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseRoutes = [
    { path: 'sites/site_id', response: mockSiteInfo },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'user', response: { name: 'test user' } },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
  ]

  test('should print the agent run diff', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/diff',
        method: 'GET' as const,
        response: (_req: express.Request, res: express.Response) => {
          res.type('text/plain').send(SAMPLE_DIFF)
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:diff', 'test_id', '--no-color'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('diff --git a/foo.txt b/foo.txt')
        expect(cliResponse).toContain('+new')
        expect(cliResponse).toContain('-old')
      })
    })
  })

  test('should print a session result diff', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/sessions/session_id/diff/result',
        method: 'GET' as const,
        response: (_req: express.Request, res: express.Response) => {
          res.type('text/plain').send(SAMPLE_DIFF)
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:diff', 'test_id', '--session', 'session_id', '--no-color'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('+new')
      })
    })
  })

  test('should print a cumulative session diff', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/sessions/session_id/diff/cumulative',
        method: 'GET' as const,
        response: (_req: express.Request, res: express.Response) => {
          res.type('text/plain').send(SAMPLE_DIFF)
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        await callCli(
          ['agents:diff', 'test_id', '--session', 'session_id', '--cumulative', '--no-color'],
          getCLIOptions({ apiUrl, builder }),
        )

        const diffRequest = requests.find((r) => r.path.endsWith('/diff/cumulative'))
        expect(diffRequest).toBeDefined()
      })
    })
  })

  test('should report when no diff is available for the task', async (t) => {
    const routes = [
      ...baseRoutes,
      {
        path: 'agent_runners/test_id/diff',
        method: 'GET' as const,
        status: 404,
        response: { error: 'not found' },
      },
      {
        path: 'agent_runners/test_id',
        method: 'GET' as const,
        response: { id: 'test_id', state: 'done' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const cliResponse = (await callCli(
          ['agents:diff', 'test_id', '--no-color'],
          getCLIOptions({ apiUrl, builder }),
        )) as string

        expect(cliResponse).toContain('No diff available for this agent run.')
      })
    })
  })

  test('should reject non-positive --page', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(
          callCli(['agents:diff', 'test_id', '--page', '0'], getCLIOptions({ apiUrl, builder })),
        ).rejects.toThrow('--page must be a positive integer')
      })
    })
  })

  test('should require agent ID argument', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(baseRoutes, async ({ apiUrl }) => {
        await expect(callCli(['agents:diff'], getCLIOptions({ apiUrl, builder }))).rejects.toThrow(
          'missing required argument',
        )
      })
    })
  })
})
