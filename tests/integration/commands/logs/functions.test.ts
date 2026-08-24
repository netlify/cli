import { Mock, afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createLogsCommand } from '../../../../src/commands/logs/index.js'
import { LOG_LEVELS } from '../../../../src/commands/logs/log-levels.js'
import { log } from '../../../../src/utils/command-helpers.js'
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
    logAndThrowError: vi.fn((message: unknown) => {
      throw message instanceof Error ? message : new Error(String(message))
    }),
  }
})

const fetchInputToUrl = (input: Parameters<typeof fetch>[0]): string => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

const siteInfo = {
  admin_url: 'https://app.netlify.com/projects/site-name/overview',
  ssl_url: 'https://site-name.netlify.app/',
  id: 'site_id',
  name: 'site-name',
  build_settings: { repo_url: 'https://github.com/owner/repo' },
}

const routes = [
  { path: 'accounts', response: [{ slug: 'test-account' }] },
  { path: 'sites', response: [] },
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  { path: 'user', response: { name: 'test user', slug: 'test-user', email: 'user@test.com' } },
  {
    path: 'sites/site_id/functions',
    response: {
      functions: [{ n: 'cool-function', a: 'account', oid: 'function-id' }],
    },
  },
  {
    path: 'sites/site_id/deploys',
    response: [{ id: 'deploy-id-1', state: 'ready' }],
  },
]

const multiFunctionRoutes = routes.map((route) => {
  if (route.path !== 'sites/site_id/functions') {
    return route
  }
  return {
    ...route,
    response: {
      functions: [
        { n: 'cool-function', a: 'account', oid: 'function-id' },
        { n: 'other-function', a: 'account', oid: 'other-function-id' },
      ],
    },
  }
})

describe('logs command', () => {
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

  describe('historical mode (default)', () => {
    const originalFetch = global.fetch

    afterEach(() => {
      global.fetch = originalFetch
    })

    test('fetches function logs for the default time window when no --since is given', async () => {
      const { apiUrl } = await startMockApi({ routes })
      const spyWebsocket = getWebSocket as unknown as Mock
      const analyticsCalls: string[] = []
      global.fetch = vi.fn<typeof fetch>(async (input, init) => {
        const url = fetchInputToUrl(input)
        if (new URL(url).hostname === 'analytics.services.netlify.com') {
          analyticsCalls.push(url)
          return new Response(JSON.stringify({ logs: [] }), { status: 200 })
        }
        return originalFetch(input, init)
      })

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync(['', '', 'logs', '--source', 'functions'])

      expect(spyWebsocket).not.toHaveBeenCalled()
      expect(analyticsCalls.length).toBeGreaterThan(0)
      expect(analyticsCalls[0]).toMatch(/from=\d+/)
      expect(analyticsCalls[0]).toMatch(/to=\d+/)
    })

    test('fetches historical logs for a given --since window', async () => {
      const { apiUrl } = await startMockApi({ routes })
      const analyticsCalls: string[] = []
      global.fetch = vi.fn<typeof fetch>(async (input, init) => {
        const url = fetchInputToUrl(input)
        if (new URL(url).hostname === 'analytics.services.netlify.com') {
          analyticsCalls.push(url)
          return new Response(
            JSON.stringify({
              logs: [
                { ts: 200, type: 'line', message: 'second', level: 'INFO' },
                { ts: 100, type: 'line', message: 'first', level: 'INFO' },
              ],
            }),
            { status: 200 },
          )
        }
        return originalFetch(input, init)
      })

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync(['', '', 'logs', '--source', 'functions', '--since', '1h'])

      const spyLog = log as unknown as Mock
      const logged = spyLog.mock.calls.map((args: string[]) => args[0])
      const firstIdx = logged.findIndex((line) => typeof line === 'string' && line.includes('first'))
      const secondIdx = logged.findIndex((line) => typeof line === 'string' && line.includes('second'))
      expect(firstIdx).toBeGreaterThan(-1)
      expect(secondIdx).toBeGreaterThan(-1)
      expect(firstIdx).toBeLessThan(secondIdx)
    })

    test('fans out across multiple functions and shows colored prefixes', async () => {
      const { apiUrl } = await startMockApi({ routes: multiFunctionRoutes })
      const spyLog = log as unknown as Mock

      const responses: Record<string, { ts: number; type: string; message: string; level: string }[]> = {
        'cool-function': [{ ts: 100, type: 'line', message: 'A-first', level: 'INFO' }],
        'other-function': [{ ts: 150, type: 'line', message: 'B-second', level: 'INFO' }],
      }
      global.fetch = vi.fn<typeof fetch>(async (input, init) => {
        const url = fetchInputToUrl(input)
        if (new URL(url).hostname === 'analytics.services.netlify.com') {
          const name = url.includes('cool-function') ? 'cool-function' : 'other-function'
          return new Response(JSON.stringify({ logs: responses[name] }), { status: 200 })
        }
        return originalFetch(input, init)
      })

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync(['', '', 'logs', '--source', 'functions', '--since', '1h'])

      const logged = spyLog.mock.calls.map((args: string[]) => args[0]).filter((line) => typeof line === 'string')
      expect(logged.some((line) => line.includes('cool-function]'))).toBe(true)
      expect(logged.some((line) => line.includes('other-function]'))).toBe(true)
    })

    test('filters functions by --function flag', async () => {
      const { apiUrl } = await startMockApi({ routes: multiFunctionRoutes })
      const analyticsCalls: string[] = []
      global.fetch = vi.fn<typeof fetch>(async (input, init) => {
        const url = fetchInputToUrl(input)
        if (new URL(url).hostname === 'analytics.services.netlify.com') {
          analyticsCalls.push(url)
          return new Response(JSON.stringify({ logs: [] }), { status: 200 })
        }
        return originalFetch(input, init)
      })

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync(['', '', 'logs', '--function', 'cool-function', '--since', '1h'])

      expect(analyticsCalls).toHaveLength(1)
      expect(analyticsCalls[0]).toContain('function_logs/cool-function')
    })

    test('infers --source functions when --function is passed', async () => {
      const { apiUrl } = await startMockApi({ routes })
      const analyticsCalls: string[] = []
      global.fetch = vi.fn<typeof fetch>(async (input, init) => {
        const url = fetchInputToUrl(input)
        if (new URL(url).hostname === 'analytics.services.netlify.com') {
          analyticsCalls.push(url)
          return new Response(JSON.stringify({ logs: [] }), { status: 200 })
        }
        return originalFetch(input, init)
      })

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync(['', '', 'logs', '--function', 'cool-function', '--since', '1h'])

      expect(analyticsCalls).toHaveLength(1)
      expect(analyticsCalls[0]).toContain('function_logs')
      expect(analyticsCalls[0]).not.toContain('edge_function_logs')
    })

    test('outputs JSON Lines when --json is passed', async () => {
      const { apiUrl } = await startMockApi({ routes })
      const stdoutChunks: string[] = []
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        stdoutChunks.push(String(chunk))
        return true
      })
      global.fetch = vi.fn<typeof fetch>(async (input, init) => {
        const url = fetchInputToUrl(input)
        if (new URL(url).hostname === 'analytics.services.netlify.com') {
          return new Response(JSON.stringify({ logs: [{ ts: 100, type: 'line', message: 'hello', level: 'INFO' }] }), {
            status: 200,
          })
        }
        return originalFetch(input, init)
      })

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync(['', '', 'logs', '--source', 'functions', '--since', '1h', '--json'])

      stdoutSpy.mockRestore()
      const output = stdoutChunks.join('')
      const lines = output.split('\n').filter(Boolean)
      expect(lines.length).toBeGreaterThan(0)
      const parsed = JSON.parse(lines[0]) as { source: string; level: string }
      expect(parsed.source).toBe('function')
      expect(parsed.level).toBe('info')
    })

    test('errors on invalid --since value', async () => {
      const { apiUrl } = await startMockApi({ routes })
      global.fetch = vi.fn<typeof fetch>(async (input, init) => originalFetch(input, init))

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await expect(program.parseAsync(['', '', 'logs', '--source', 'functions', '--since', 'bogus'])).rejects.toThrow(
        /Invalid time value/,
      )
    })
  })

  describe('--follow mode', () => {
    test('opens a websocket per function in follow mode', async () => {
      const { apiUrl } = await startMockApi({ routes })
      const spyWebsocket = getWebSocket as unknown as Mock
      spyWebsocket.mockReturnValue({ on: vi.fn(), send: vi.fn() })

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync(['', '', 'logs', '--source', 'functions', '--follow'])

      expect(spyWebsocket).toHaveBeenCalledOnce()
    })

    test('errors when --follow is used with --since', async () => {
      const { apiUrl } = await startMockApi({ routes })
      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await expect(program.parseAsync(['', '', 'logs', '--follow', '--since', '1h'])).rejects.toThrow(
        /--follow cannot be used together with --since/,
      )
    })

    test('prints streaming header in follow mode', async () => {
      const { apiUrl } = await startMockApi({ routes })
      const spyWebsocket = getWebSocket as unknown as Mock
      spyWebsocket.mockReturnValue({ on: vi.fn(), send: vi.fn() })
      const spyLog = log as unknown as Mock

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync(['', '', 'logs', '--source', 'functions', '--follow'])

      const logged = spyLog.mock.calls.map((args: string[]) => args[0]).join('\n')
      expect(logged).toContain('Streaming logs from')
    })

    test('streams function logs with level filtering', async () => {
      const { apiUrl } = await startMockApi({ routes })
      const spyWebsocket = getWebSocket as unknown as Mock
      const spyOn = vi.fn()
      spyWebsocket.mockReturnValue({ on: spyOn, send: vi.fn() })
      const spyLog = log as unknown as Mock

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync(['', '', 'logs', '--source', 'functions', '--follow', '--level', 'info'])

      const messageCallback = spyOn.mock.calls.find((args) => args[0] === 'message')
      messageCallback?.[1](JSON.stringify({ level: LOG_LEVELS.INFO, message: 'Hello World' }))
      messageCallback?.[1](JSON.stringify({ level: LOG_LEVELS.WARN, message: 'Warning' }))

      const loggedMessages = spyLog.mock.calls
        .map((args: string[]) => args[0])
        .filter((line) => typeof line === 'string' && (line.includes('Hello') || line.includes('Warning')))
      expect(loggedMessages).toHaveLength(1)
      expect(loggedMessages[0]).toContain('Hello World')
    })
  })

  describe('deprecated commands', () => {
    test('logs:function shows deprecation error with migration guidance', async () => {
      const { apiUrl } = await startMockApi({ routes })
      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await expect(program.parseAsync(['', '', 'logs:function'])).rejects.toThrow(
        /has been replaced by a more comprehensive/,
      )
    })

    test('logs:function includes function name in suggested command', async () => {
      const { apiUrl } = await startMockApi({ routes })
      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await expect(program.parseAsync(['', '', 'logs:function', 'my-func'])).rejects.toThrow(/--function my-func/)
    })

    test('logs:deploy shows deprecation error with migration guidance', async () => {
      const { apiUrl } = await startMockApi({ routes })
      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await expect(program.parseAsync(['', '', 'logs:deploy'])).rejects.toThrow(
        /has been replaced by a more comprehensive/,
      )
    })
  })

  describe('--url validation', () => {
    const originalFetch = global.fetch

    afterEach(() => {
      global.fetch = originalFetch
    })

    test('rejects a URL that belongs to a different project', async () => {
      const { apiUrl } = await startMockApi({ routes })
      global.fetch = vi.fn<typeof fetch>(async (input, init) => originalFetch(input, init))

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await expect(
        program.parseAsync([
          '',
          '',
          'logs',
          '--source',
          'functions',
          '--since',
          '1h',
          '--url',
          'https://feature-x--some-other-site.netlify.app',
        ]),
      ).rejects.toThrow(/doesn't seem to match the linked project/)
    })

    test('accepts a production URL as no deploy filter', async () => {
      const { apiUrl } = await startMockApi({ routes })
      const analyticsCalls: string[] = []
      global.fetch = vi.fn<typeof fetch>(async (input, init) => {
        const url = fetchInputToUrl(input)
        if (new URL(url).hostname === 'analytics.services.netlify.com') {
          analyticsCalls.push(url)
          return new Response(JSON.stringify({ logs: [] }), { status: 200 })
        }
        return originalFetch(input, init)
      })

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync([
        '',
        '',
        'logs',
        '--source',
        'functions',
        '--since',
        '1h',
        '--url',
        'https://site-name.netlify.app',
      ])

      expect(analyticsCalls[0]).not.toContain('deploy_id=')
    })

    test('passes deploy_id when URL uses a deploy permalink', async () => {
      const deployId = '507f1f77bcf86cd799439011'
      const deployRoutes = [
        ...routes,
        {
          path: `sites/site_id/deploys/${deployId}`,
          response: {
            id: deployId,
            state: 'ready',
            available_functions: [{ n: 'cool-function', a: 'account', oid: 'deploy-fn-oid' }],
          },
        },
      ]
      const { apiUrl } = await startMockApi({ routes: deployRoutes })
      const analyticsCalls: string[] = []
      global.fetch = vi.fn<typeof fetch>(async (input, init) => {
        const url = fetchInputToUrl(input)
        if (new URL(url).hostname === 'analytics.services.netlify.com') {
          analyticsCalls.push(url)
          return new Response(JSON.stringify({ logs: [] }), { status: 200 })
        }
        return originalFetch(input, init)
      })

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync([
        '',
        '',
        'logs',
        '--source',
        'functions',
        '--since',
        '1h',
        '--url',
        `https://${deployId}--site-name.netlify.app`,
      ])

      expect(analyticsCalls).toHaveLength(1)
      expect(analyticsCalls[0]).toContain(`deploy_id=${deployId}`)
    })
  })
})
