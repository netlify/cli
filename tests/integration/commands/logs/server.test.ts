import { Mock, afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createLogsCommand } from '../../../../src/commands/logs/index.js'
import { log, warn } from '../../../../src/utils/command-helpers.js'
import { getWebSocket } from '../../../../src/utils/websockets/index.js'
import { startMockApi } from '../../utils/mock-api-vitest.js'
import { getEnvironmentVariables } from '../../utils/mock-api.js'

vi.mock('../../../../src/utils/websockets/index.js', () => ({
  getWebSocket: vi.fn(),
}))

vi.mock('../../../../src/utils/command-helpers.js', async () => {
  const actual = await vi.importActual('../../../../src/utils/command-helpers.js')
  return {
    ...actual,
    log: vi.fn(),
    warn: vi.fn(),
    logAndThrowError: vi.fn((message: unknown) => {
      throw message instanceof Error ? message : new Error(String(message))
    }),
  }
})

const siteInfo = {
  admin_url: 'https://app.netlify.com/projects/site-name/overview',
  ssl_url: 'https://site-name.netlify.app/',
  id: 'site_id',
  name: 'site-name',
  build_settings: { repo_url: 'https://github.com/owner/repo' },
}

const baseRoutes = [
  { path: 'accounts', response: [{ slug: 'test-account' }] },
  { path: 'sites', response: [] },
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  { path: 'user', response: { name: 'test user', slug: 'test-user', email: 'user@test.com' } },
]

describe('logs --source server', () => {
  const originalEnv = process.env

  let program: BaseCommand

  afterEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  beforeEach(() => {
    program = new BaseCommand('netlify')
    createLogsCommand(program)
  })

  afterAll(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  test('prints the server log lines of the window, oldest first', async () => {
    const queries: Record<string, unknown>[] = []
    const { apiUrl } = await startMockApi({
      routes: [
        ...baseRoutes,
        {
          path: 'sites/site_id/observability/server/logs',
          response: (req, res) => {
            queries.push(req.query)
            res.json({
              logs: [
                { timestamp: 200, severity: 'error', body: 'second line', actor_id: 'actor-b' },
                { timestamp: 100, severity: 'info', body: 'first line', actor_id: 'actor-a' },
              ],
              page: 1,
              has_next_page: false,
            })
          },
        },
      ],
    })
    Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

    await program.parseAsync(['', '', 'logs', '--source', 'server', '--since', '1h'])

    expect(queries).toHaveLength(1)
    const fromTs = Number(queries[0].from_ts)
    const toTs = Number(queries[0].to_ts)
    expect(toTs - fromTs).toBe(60 * 60 * 1000)

    const logged = (log as unknown as Mock).mock.calls
      .map((args: unknown[]) => args[0])
      .filter((line): line is string => typeof line === 'string')
    const firstIdx = logged.findIndex((line) => line.includes('first line'))
    const secondIdx = logged.findIndex((line) => line.includes('second line'))
    expect(firstIdx).toBeGreaterThan(-1)
    expect(firstIdx).toBeLessThan(secondIdx)
    expect(logged[secondIdx]).toContain('actor-b]')
    expect(logged[secondIdx]).toContain('ERROR')
    expect(getWebSocket).not.toHaveBeenCalled()
  })

  test('warns when the window holds more lines than the API pages through', async () => {
    const { apiUrl } = await startMockApi({
      routes: [
        ...baseRoutes,
        {
          path: 'sites/site_id/observability/server/logs',
          response: {
            logs: [{ timestamp: 100, severity: 'info', body: 'a line', actor_id: 'actor-a' }],
            has_next_page: true,
          },
        },
      ],
    })
    Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

    await program.parseAsync(['', '', 'logs', '--source', 'server', '--since', '7d'])

    expect(warn).toHaveBeenCalledOnce()
    expect((warn as unknown as Mock).mock.calls[0]?.[0]).toContain('--since')
  })

  test('does not warn when every line of the window was fetched', async () => {
    const { apiUrl } = await startMockApi({
      routes: [
        ...baseRoutes,
        {
          path: 'sites/site_id/observability/server/logs',
          response: {
            logs: [{ timestamp: 100, severity: 'info', body: 'a line', actor_id: 'actor-a' }],
            has_next_page: false,
          },
        },
      ],
    })
    Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

    await program.parseAsync(['', '', 'logs', '--source', 'server', '--since', '1h'])

    expect(warn).not.toHaveBeenCalled()
  })

  test('reports a failed request', async () => {
    const { apiUrl } = await startMockApi({
      routes: [...baseRoutes, { path: 'sites/site_id/observability/server/logs', status: 403, response: {} }],
    })
    Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

    await expect(program.parseAsync(['', '', 'logs', '--source', 'server', '--since', '1h'])).rejects.toThrow(
      'Failed to fetch server logs: 403',
    )
  })
})
