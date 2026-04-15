import { Mock, afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createLogsFunctionCommand } from '../../../../src/commands/logs/index.js'
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

const siteInfo = {
  admin_url: 'https://app.netlify.com/projects/site-name/overview',
  ssl_url: 'https://site-name.netlify.app/',
  id: 'site_id',
  name: 'site-name',
  build_settings: { repo_url: 'https://github.com/owner/repo' },
}

const routes = [
  {
    path: 'accounts',
    response: [{ slug: 'test-account' }],
  },
  {
    path: 'sites',
    response: [],
  },
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  {
    path: 'user',
    response: { name: 'test user', slug: 'test-user', email: 'user@test.com' },
  },
  {
    path: 'sites/site_id/functions',
    response: {
      functions: [
        {
          n: 'cool-function',
          a: 'account',
          oid: 'function-id',
        },
      ],
    },
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

describe('logs:function command', () => {
  const originalEnv = process.env

  let program: BaseCommand

  afterEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  beforeEach(() => {
    program = new BaseCommand('netlify')

    createLogsFunctionCommand(program)
  })

  afterAll(() => {
    vi.restoreAllMocks()
    vi.resetModules()

    process.env = { ...originalEnv }
  })

  test('should setup the functions stream correctly', async ({}) => {
    const { apiUrl } = await startMockApi({ routes })
    const spyWebsocket = getWebSocket as unknown as Mock
    const spyOn = vi.fn()
    const spySend = vi.fn()
    spyWebsocket.mockReturnValue({
      on: spyOn,
      send: spySend,
    })

    const env = getEnvironmentVariables({ apiUrl })
    Object.assign(process.env, env)

    await program.parseAsync(['', '', 'logs:function'])

    expect(spyWebsocket).toHaveBeenCalledOnce()
    expect(spyOn).toHaveBeenCalledTimes(4)
  })

  test('should send the correct payload to the websocket', async ({}) => {
    const { apiUrl } = await startMockApi({ routes })
    const spyWebsocket = getWebSocket as unknown as Mock
    const spyOn = vi.fn()
    const spySend = vi.fn()
    spyWebsocket.mockReturnValue({
      on: spyOn,
      send: spySend,
    })

    const env = getEnvironmentVariables({ apiUrl })
    Object.assign(process.env, env)

    await program.parseAsync(['', '', 'logs:function'])

    const setupCall = spyOn.mock.calls.find((args) => args[0] === 'open')
    expect(setupCall).toBeDefined()

    const openCallback = setupCall?.[1]
    openCallback?.()

    expect(spySend).toHaveBeenCalledOnce()
    const call = spySend.mock.calls[0]
    const [message] = call
    const body = JSON.parse(message)

    expect(body.function_id).toEqual('function-id')
    expect(body.site_id).toEqual('site_id')
    expect(body.account_id).toEqual('account')
    expect(body.access_token).toEqual(env.NETLIFY_AUTH_TOKEN)
  })

  test('should print only specified log levels', async ({}) => {
    const { apiUrl } = await startMockApi({ routes })
    const spyWebsocket = getWebSocket as unknown as Mock
    const spyOn = vi.fn()
    const spySend = vi.fn()
    spyWebsocket.mockReturnValue({
      on: spyOn,
      send: spySend,
    })
    const spyLog = log as unknown as Mock

    const env = getEnvironmentVariables({ apiUrl })
    Object.assign(process.env, env)

    await program.parseAsync(['', '', 'logs:function', 'cool-function', '--level', 'info'])
    const messageCallback = spyOn.mock.calls.find((args) => args[0] === 'message')
    const messageCallbackFunc = messageCallback?.[1]
    const mockInfoData = {
      level: LOG_LEVELS.INFO,
      message: 'Hello World',
    }
    const mockWarnData = {
      level: LOG_LEVELS.WARN,
      message: 'There was a warning',
    }

    messageCallbackFunc?.(JSON.stringify(mockInfoData))
    messageCallbackFunc?.(JSON.stringify(mockWarnData))

    // 4 header lines (tip + blank + polling + blank) + 1 info log (warn filtered out)
    expect(spyLog).toHaveBeenCalledTimes(5)
  })

  test('should print all the log levels', async ({}) => {
    const { apiUrl } = await startMockApi({ routes })
    const spyWebsocket = getWebSocket as unknown as Mock
    const spyOn = vi.fn()
    const spySend = vi.fn()
    spyWebsocket.mockReturnValue({
      on: spyOn,
      send: spySend,
    })
    const spyLog = log as unknown as Mock

    const env = getEnvironmentVariables({ apiUrl })
    Object.assign(process.env, env)

    await program.parseAsync(['', '', 'logs:function', 'cool-function'])
    const messageCallback = spyOn.mock.calls.find((args) => args[0] === 'message')
    const messageCallbackFunc = messageCallback?.[1]
    const mockInfoData = {
      level: LOG_LEVELS.INFO,
      message: 'Hello World',
    }
    const mockWarnData = {
      level: LOG_LEVELS.WARN,
      message: 'There was a warning',
    }

    messageCallbackFunc?.(JSON.stringify(mockInfoData))
    messageCallbackFunc?.(JSON.stringify(mockWarnData))

    // 4 header lines (tip + blank + polling + blank) + 2 log entries
    expect(spyLog).toHaveBeenCalledTimes(6)
  })

  test('should open one websocket per function when no name is given', async ({}) => {
    const { apiUrl } = await startMockApi({ routes: multiFunctionRoutes })
    const spyWebsocket = getWebSocket as unknown as Mock
    spyWebsocket.mockReturnValue({ on: vi.fn(), send: vi.fn() })

    const env = getEnvironmentVariables({ apiUrl })
    Object.assign(process.env, env)

    await program.parseAsync(['', '', 'logs:function'])

    expect(spyWebsocket).toHaveBeenCalledTimes(2)
  })

  test('should prefix log lines with the function name in multi-function mode', async ({}) => {
    const { apiUrl } = await startMockApi({ routes: multiFunctionRoutes })
    const spyWebsocket = getWebSocket as unknown as Mock
    const handlersPerSocket: Record<string, (data: string) => void>[] = []
    spyWebsocket.mockImplementation(() => {
      const handlers: Record<string, (data: string) => void> = {}
      handlersPerSocket.push(handlers)
      return {
        on: (event: string, cb: (data: string) => void) => {
          handlers[event] = cb
        },
        send: vi.fn(),
      }
    })
    const spyLog = log as unknown as Mock

    const env = getEnvironmentVariables({ apiUrl })
    Object.assign(process.env, env)

    await program.parseAsync(['', '', 'logs:function'])

    handlersPerSocket[0].message(JSON.stringify({ level: LOG_LEVELS.INFO, message: 'hello from first' }))
    handlersPerSocket[1].message(JSON.stringify({ level: LOG_LEVELS.INFO, message: 'hello from second' }))

    const logged = spyLog.mock.calls.map((args: string[]) => args[0]).join('\n')
    expect(logged).toContain('[Function: cool-function]')
    expect(logged).toContain('[Function: other-function]')
  })

  test('should open one websocket per named function and prefix lines when multiple names are passed', async ({}) => {
    const { apiUrl } = await startMockApi({ routes: multiFunctionRoutes })
    const spyWebsocket = getWebSocket as unknown as Mock
    const handlersPerSocket: Record<string, (data: string) => void>[] = []
    spyWebsocket.mockImplementation(() => {
      const handlers: Record<string, (data: string) => void> = {}
      handlersPerSocket.push(handlers)
      return {
        on: (event: string, cb: (data: string) => void) => {
          handlers[event] = cb
        },
        send: vi.fn(),
      }
    })
    const spyLog = log as unknown as Mock

    const env = getEnvironmentVariables({ apiUrl })
    Object.assign(process.env, env)

    await program.parseAsync(['', '', 'logs:function', 'cool-function', 'other-function'])

    expect(spyWebsocket).toHaveBeenCalledTimes(2)

    handlersPerSocket[0].message(JSON.stringify({ level: LOG_LEVELS.INFO, message: 'from first' }))
    handlersPerSocket[1].message(JSON.stringify({ level: LOG_LEVELS.INFO, message: 'from second' }))

    const logged = spyLog.mock.calls.map((args: string[]) => args[0]).join('\n')
    expect(logged).toContain('[Function: cool-function]')
    expect(logged).toContain('[Function: other-function]')
  })

  test('should error when a passed function name does not exist', async ({}) => {
    const { apiUrl } = await startMockApi({ routes: multiFunctionRoutes })
    const spyWebsocket = getWebSocket as unknown as Mock
    spyWebsocket.mockReturnValue({ on: vi.fn(), send: vi.fn() })
    const spyLog = log as unknown as Mock

    const env = getEnvironmentVariables({ apiUrl })
    Object.assign(process.env, env)

    await program.parseAsync(['', '', 'logs:function', 'nope'])

    expect(spyWebsocket).not.toHaveBeenCalled()
    const logged = spyLog.mock.calls.map((args) => args[0]).join('\n')
    expect(logged).toContain('Could not find function nope')
  })

  test('should refuse to stream all when the project has more than 10 functions', async ({}) => {
    const manyFunctions = Array.from({ length: 11 }, (_, i) => ({
      n: `fn-${i}`,
      a: 'account',
      oid: `fn-${i}-id`,
    }))
    const manyFunctionRoutes = routes.map((route) =>
      route.path === 'sites/site_id/functions' ? { ...route, response: { functions: manyFunctions } } : route,
    )
    const { apiUrl } = await startMockApi({ routes: manyFunctionRoutes })
    const spyWebsocket = getWebSocket as unknown as Mock
    spyWebsocket.mockReturnValue({ on: vi.fn(), send: vi.fn() })

    const env = getEnvironmentVariables({ apiUrl })
    Object.assign(process.env, env)

    await expect(program.parseAsync(['', '', 'logs:function'])).rejects.toThrow(/up to 10 functions at a time/)

    expect(spyWebsocket).not.toHaveBeenCalled()
  })

  describe('--since/--until', () => {
    const originalFetch = global.fetch

    afterEach(() => {
      global.fetch = originalFetch
    })

    test('fetches historical logs for a single function and prints them sorted', async ({}) => {
      const { apiUrl } = await startMockApi({ routes })
      const spyWebsocket = getWebSocket as unknown as Mock
      const spyLog = log as unknown as Mock

      const fetchCalls: string[] = []
      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input)
        if (!url.includes('analytics.services.netlify.com')) {
          return originalFetch(input, init)
        }
        fetchCalls.push(url)
        return new Response(
          JSON.stringify({
            logs: [
              { ts: 200, type: 'line', message: 'second', level: 'INFO' },
              { ts: 100, type: 'line', message: 'first', level: 'INFO' },
            ],
          }),
          { status: 200 },
        )
      }) as any

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync([
        '',
        '',
        'logs:function',
        'cool-function',
        '--since',
        '2026-04-14T00:00:00Z',
        '--until',
        '2026-04-15T00:00:00Z',
      ])

      expect(spyWebsocket).not.toHaveBeenCalled()
      expect(fetchCalls).toHaveLength(1)
      expect(fetchCalls[0]).toContain('https://analytics.services.netlify.com/v2/sites/site_id/function_logs/cool-function')
      expect(fetchCalls[0]).toMatch(/from=\d+/)
      expect(fetchCalls[0]).toMatch(/to=\d+/)
      expect(fetchCalls[0]).not.toContain('deploy_id=')

      const logged = spyLog.mock.calls.map((args) => args[0])
      const firstIdx = logged.findIndex((line) => typeof line === 'string' && line.includes('first'))
      const secondIdx = logged.findIndex((line) => typeof line === 'string' && line.includes('second'))
      expect(firstIdx).toBeGreaterThan(-1)
      expect(secondIdx).toBeGreaterThan(-1)
      expect(firstIdx).toBeLessThan(secondIdx)
    })

    test('fans out across multiple functions and interleaves by timestamp', async ({}) => {
      const { apiUrl } = await startMockApi({ routes: multiFunctionRoutes })
      const spyLog = log as unknown as Mock

      const responses: Record<string, { ts: number; type: string; message: string; level: string }[]> = {
        'cool-function': [{ ts: 100, type: 'line', message: 'A-first', level: 'INFO' }],
        'other-function': [{ ts: 150, type: 'line', message: 'B-second', level: 'INFO' }],
      }
      const analyticsCalls: string[] = []
      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input)
        if (!url.includes('analytics.services.netlify.com')) {
          return originalFetch(input, init)
        }
        analyticsCalls.push(url)
        const name = url.includes('cool-function') ? 'cool-function' : 'other-function'
        return new Response(JSON.stringify({ logs: responses[name] }), { status: 200 })
      }) as any

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync(['', '', 'logs:function', '--since', '2026-04-14T00:00:00Z'])

      expect(analyticsCalls).toHaveLength(2)
      const logged = spyLog.mock.calls.map((args: string[]) => args[0]).filter((line) => typeof line === 'string')
      const aLine = logged.find((line) => line.includes('A-first'))
      const bLine = logged.find((line) => line.includes('B-second'))
      expect(aLine).toContain('[Function: cool-function]')
      expect(bLine).toContain('[Function: other-function]')
      expect(logged.indexOf(aLine as string)).toBeLessThan(logged.indexOf(bLine as string))
    })

    test('follows pagination cursor', async ({}) => {
      const { apiUrl } = await startMockApi({ routes })
      const calls: string[] = []
      let callNumber = 0
      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input)
        if (!url.includes('analytics.services.netlify.com')) {
          return originalFetch(input, init)
        }
        calls.push(url)
        callNumber += 1
        if (callNumber === 1) {
          return new Response(
            JSON.stringify({
              logs: [{ ts: 1, type: 'line', message: 'page1', level: 'INFO' }],
              pagination: { next: 'cursor-xyz' },
            }),
            { status: 200 },
          )
        }
        return new Response(
          JSON.stringify({
            logs: [{ ts: 2, type: 'line', message: 'page2', level: 'INFO' }],
          }),
          { status: 200 },
        )
      }) as any

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync(['', '', 'logs:function', 'cool-function', '--since', '2026-04-14T00:00:00Z'])

      expect(calls).toHaveLength(2)
      expect(calls[1]).toContain('cursor=cursor-xyz')
    })

    test('errors on an unparseable --since value', async ({}) => {
      const { apiUrl } = await startMockApi({ routes })
      const spyLog = log as unknown as Mock
      const analyticsCalls: string[] = []
      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input)
        if (url.includes('analytics.services.netlify.com')) {
          analyticsCalls.push(url)
          return new Response(JSON.stringify({ logs: [] }), { status: 200 })
        }
        return originalFetch(input, init)
      }) as any

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync(['', '', 'logs:function', 'cool-function', '--since', 'bogus'])

      expect(analyticsCalls).toHaveLength(0)
      const logged = spyLog.mock.calls.map((args: string[]) => args[0]).join('\n')
      expect(logged).toContain('Invalid time value')
    })

    test('errors when --since is later than --until', async ({}) => {
      const { apiUrl } = await startMockApi({ routes })
      const spyLog = log as unknown as Mock
      const analyticsCalls: string[] = []
      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input)
        if (url.includes('analytics.services.netlify.com')) {
          analyticsCalls.push(url)
          return new Response(JSON.stringify({ logs: [] }), { status: 200 })
        }
        return originalFetch(input, init)
      }) as any

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync([
        '',
        '',
        'logs:function',
        'cool-function',
        '--since',
        '2026-04-14T00:00:00Z',
        '--until',
        '2026-04-13T00:00:00Z',
      ])

      expect(analyticsCalls).toHaveLength(0)
      const logged = spyLog.mock.calls.map((args: string[]) => args[0]).join('\n')
      expect(logged).toContain('--since must be earlier than --until')
    })

    test('accepts a duration for --since and converts it to now minus the duration', async ({}) => {
      const { apiUrl } = await startMockApi({ routes })
      const analyticsCalls: string[] = []
      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input)
        if (!url.includes('analytics.services.netlify.com')) {
          return originalFetch(input, init)
        }
        analyticsCalls.push(url)
        return new Response(JSON.stringify({ logs: [] }), { status: 200 })
      }) as any

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      const before = Date.now()
      await program.parseAsync(['', '', 'logs:function', 'cool-function', '--since', '1h'])
      const after = Date.now()

      expect(analyticsCalls).toHaveLength(1)
      const parsed = new URL(analyticsCalls[0])
      const from = Number(parsed.searchParams.get('from'))
      const to = Number(parsed.searchParams.get('to'))
      expect(to - from).toBe(60 * 60 * 1000)
      expect(to).toBeGreaterThanOrEqual(before)
      expect(to).toBeLessThanOrEqual(after)
    })
  })

  describe('--url', () => {
    const originalFetch = global.fetch

    afterEach(() => {
      global.fetch = originalFetch
    })

    test('passes deploy_id when the URL uses a deploy permalink', async ({}) => {
      const deployId = '507f1f77bcf86cd799439011'
      const deployRoutes = [
        ...routes,
        {
          path: `sites/site_id/deploys/${deployId}`,
          response: {
            id: deployId,
            state: 'ready',
            available_functions: [{ n: 'cool-function', a: 'account', oid: 'function-id' }],
          },
        },
      ]
      const { apiUrl } = await startMockApi({ routes: deployRoutes })
      const fetchCalls: string[] = []
      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input)
        if (!url.includes('analytics.services.netlify.com')) {
          return originalFetch(input, init)
        }
        fetchCalls.push(url)
        return new Response(JSON.stringify({ logs: [] }), { status: 200 })
      }) as any

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync([
        '',
        '',
        'logs:function',
        'cool-function',
        '--since',
        '2026-04-14T00:00:00Z',
        '--url',
        `https://${deployId}--site-name.netlify.app`,
      ])

      expect(fetchCalls).toHaveLength(1)
      expect(fetchCalls[0]).toContain(`deploy_id=${deployId}`)
    })

    test('resolves a branch name via listSiteDeploys', async ({}) => {
      const deployRoutes = [
        ...routes,
        {
          path: 'sites/site_id/deploys',
          response: [
            { id: 'deploy-building', state: 'building', branch: 'feature-x' },
            { id: 'deploy-ready-id', state: 'ready', branch: 'feature-x' },
          ],
        },
        {
          path: 'sites/site_id/deploys/deploy-ready-id',
          response: {
            id: 'deploy-ready-id',
            state: 'ready',
            available_functions: [{ n: 'cool-function', a: 'account', oid: 'function-id' }],
          },
        },
      ]
      const { apiUrl } = await startMockApi({ routes: deployRoutes })
      const fetchCalls: string[] = []
      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input)
        if (!url.includes('analytics.services.netlify.com')) {
          return originalFetch(input, init)
        }
        fetchCalls.push(url)
        return new Response(JSON.stringify({ logs: [] }), { status: 200 })
      }) as any

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync([
        '',
        '',
        'logs:function',
        'cool-function',
        '--since',
        '2026-04-14T00:00:00Z',
        '--url',
        'https://feature-x--site-name.netlify.app',
      ])

      expect(fetchCalls[0]).toContain('deploy_id=deploy-ready-id')
    })

    test('treats a production URL as no deploy filter', async ({}) => {
      const { apiUrl } = await startMockApi({ routes })
      const fetchCalls: string[] = []
      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input)
        if (!url.includes('analytics.services.netlify.com')) {
          return originalFetch(input, init)
        }
        fetchCalls.push(url)
        return new Response(JSON.stringify({ logs: [] }), { status: 200 })
      }) as any

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync([
        '',
        '',
        'logs:function',
        'cool-function',
        '--since',
        '2026-04-14T00:00:00Z',
        '--url',
        'https://site-name.netlify.app',
      ])

      expect(fetchCalls[0]).not.toContain('deploy_id=')
    })

    test('opens a real-time stream against the deploy-specific function oid when --url resolves to a deploy', async ({}) => {
      const deployId = '507f1f77bcf86cd799439011'
      const deployRoutes = [
        ...routes,
        {
          path: `sites/site_id/deploys/${deployId}`,
          response: {
            id: deployId,
            state: 'ready',
            available_functions: [{ n: 'cool-function', a: 'account', oid: 'deploy-specific-oid' }],
          },
        },
      ]
      const { apiUrl } = await startMockApi({ routes: deployRoutes })
      const spyWebsocket = getWebSocket as unknown as Mock
      const spyOn = vi.fn()
      const spySend = vi.fn()
      spyWebsocket.mockReturnValue({ on: spyOn, send: spySend })

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync([
        '',
        '',
        'logs:function',
        'cool-function',
        '--url',
        `https://${deployId}--site-name.netlify.app`,
      ])

      expect(spyWebsocket).toHaveBeenCalledOnce()

      const openCall = spyOn.mock.calls.find((args) => args[0] === 'open')
      openCall?.[1]()

      expect(spySend).toHaveBeenCalledOnce()
      const sentPayload = JSON.parse(spySend.mock.calls[0][0] as string) as { function_id: string }
      expect(sentPayload.function_id).toBe('deploy-specific-oid')
    })

    test('rejects a URL that belongs to a different project', async ({}) => {
      const { apiUrl } = await startMockApi({ routes })
      const analyticsCalls: string[] = []
      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input)
        if (url.includes('analytics.services.netlify.com')) {
          analyticsCalls.push(url)
          return new Response(JSON.stringify({ logs: [] }), { status: 200 })
        }
        return originalFetch(input, init)
      }) as any

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await expect(
        program.parseAsync([
          '',
          '',
          'logs:function',
          'cool-function',
          '--since',
          '1h',
          '--url',
          'https://feature-x--some-other-site.netlify.app',
        ]),
      ).rejects.toThrow(/doesn't seem to match the linked project/)

      expect(analyticsCalls).toHaveLength(0)
    })

    test('rejects a non-netlify hostname that does not match any configured domain', async ({}) => {
      const { apiUrl } = await startMockApi({ routes })
      const analyticsCalls: string[] = []
      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input)
        if (url.includes('analytics.services.netlify.com')) {
          analyticsCalls.push(url)
          return new Response(JSON.stringify({ logs: [] }), { status: 200 })
        }
        return originalFetch(input, init)
      }) as any

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await expect(
        program.parseAsync([
          '',
          '',
          'logs:function',
          'cool-function',
          '--since',
          '1h',
          '--url',
          'https://totally-unrelated.example.com',
        ]),
      ).rejects.toThrow(/doesn't seem to match the linked project/)

      expect(analyticsCalls).toHaveLength(0)
    })

    test('accepts a custom domain configured on the linked project', async ({}) => {
      const customDomainSiteInfo = {
        ...siteInfo,
        custom_domain: 'www.my-custom-domain.com',
        domain_aliases: ['my-custom-domain.com'],
      }
      const customRoutes = routes.map((route) =>
        route.path === 'sites/site_id' ? { ...route, response: customDomainSiteInfo } : route,
      )
      const { apiUrl } = await startMockApi({ routes: customRoutes })
      const fetchCalls: string[] = []
      global.fetch = vi.fn(async (input: any, init?: any) => {
        const url = String(input)
        if (!url.includes('analytics.services.netlify.com')) {
          return originalFetch(input, init)
        }
        fetchCalls.push(url)
        return new Response(JSON.stringify({ logs: [] }), { status: 200 })
      }) as any

      const env = getEnvironmentVariables({ apiUrl })
      Object.assign(process.env, env)

      await program.parseAsync([
        '',
        '',
        'logs:function',
        'cool-function',
        '--since',
        '1h',
        '--url',
        'https://www.my-custom-domain.com',
      ])

      expect(fetchCalls).toHaveLength(1)
      expect(fetchCalls[0]).not.toContain('deploy_id=')
    })
  })

  test('should open a single websocket and omit the prefix when a function name is passed', async ({}) => {
    const { apiUrl } = await startMockApi({ routes: multiFunctionRoutes })
    const spyWebsocket = getWebSocket as unknown as Mock
    const spyOn = vi.fn()
    spyWebsocket.mockReturnValue({ on: spyOn, send: vi.fn() })
    const spyLog = log as unknown as Mock

    const env = getEnvironmentVariables({ apiUrl })
    Object.assign(process.env, env)

    await program.parseAsync(['', '', 'logs:function', 'cool-function'])

    expect(spyWebsocket).toHaveBeenCalledOnce()

    const messageCallback = spyOn.mock.calls.find((args) => args[0] === 'message')
    messageCallback?.[1](JSON.stringify({ level: LOG_LEVELS.INFO, message: 'hello' }))

    const logged = spyLog.mock.calls.map((args) => args[0]).join('\n')
    expect(logged).not.toContain('[Function: cool-function]')
    expect(logged).toContain('hello')
  })
})
