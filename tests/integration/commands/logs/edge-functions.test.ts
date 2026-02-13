import { Mock, afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createLogsEdgeFunctionCommand } from '../../../../src/commands/logs/index.js'
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
  }
})

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({ result: 'deploy-id-1' }),
    registerPrompt: vi.fn(),
  },
}))

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
    path: 'sites/site_id/deploys',
    response: [
      {
        id: 'deploy-id-1',
        context: 'production',
        user_id: 'user-1',
        review_id: null,
      },
    ],
  },
]

describe('logs:edge-functions command', () => {
  const originalEnv = process.env

  let program: BaseCommand

  afterEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  beforeEach(() => {
    program = new BaseCommand('netlify')

    createLogsEdgeFunctionCommand(program)
  })

  afterAll(() => {
    vi.restoreAllMocks()
    vi.resetModules()

    process.env = { ...originalEnv }
  })

  test('should setup the edge functions stream correctly', async () => {
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

    await program.parseAsync(['', '', 'logs:edge-functions'])

    expect(spyWebsocket).toHaveBeenCalledOnce()
    expect(spyWebsocket).toHaveBeenCalledWith('wss://socketeer.services.netlify.com/edge-function/logs')
    expect(spyOn).toHaveBeenCalledTimes(4)
  })

  test('should send the correct payload to the websocket', async () => {
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

    await program.parseAsync(['', '', 'logs:edge-functions'])

    const setupCall = spyOn.mock.calls.find((args) => args[0] === 'open')
    expect(setupCall).toBeDefined()

    const openCallback = setupCall?.[1]
    openCallback?.()

    expect(spySend).toHaveBeenCalledOnce()
    const call = spySend.mock.calls[0]
    const [message] = call
    const body = JSON.parse(message)

    expect(body.deploy_id).toEqual('deploy-id-1')
    expect(body.site_id).toEqual('site_id')
    expect(body.access_token).toEqual(env.NETLIFY_AUTH_TOKEN)
    expect(body.since).toBeDefined()
  })

  test('should use deploy ID from --deploy-id option when provided', async () => {
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

    await program.parseAsync(['', '', 'logs:edge-functions', '--deploy-id', 'my-deploy-id'])

    const setupCall = spyOn.mock.calls.find((args) => args[0] === 'open')
    const openCallback = setupCall?.[1]
    openCallback?.()

    const call = spySend.mock.calls[0]
    const body = JSON.parse(call[0])

    expect(body.deploy_id).toEqual('my-deploy-id')
  })

  test('should print only specified log levels', async () => {
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

    await program.parseAsync(['', '', 'logs:edge-functions', '--level', 'info'])
    const messageCallback = spyOn.mock.calls.find((args) => args[0] === 'message')
    const messageCallbackFunc = messageCallback?.[1]

    messageCallbackFunc?.(JSON.stringify({ level: LOG_LEVELS.INFO, message: 'Hello World' }))
    messageCallbackFunc?.(JSON.stringify({ level: LOG_LEVELS.WARN, message: 'There was a warning' }))

    expect(spyLog).toHaveBeenCalledTimes(1)
  })

  test('should fetch historical logs when --from is specified', async () => {
    const { apiUrl } = await startMockApi({ routes })
    const spyWebsocket = getWebSocket as unknown as Mock

    const env = getEnvironmentVariables({ apiUrl })
    Object.assign(process.env, env)

    const mockLogs = [{ timestamp: '2026-01-15T10:00:00Z', level: 'info', message: 'Edge function executed' }]

    const originalFetch = global.fetch
    const spyFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('analytics.services.netlify.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockLogs),
        })
      }
      return originalFetch(url)
    })
    global.fetch = spyFetch

    try {
      await program.parseAsync(['', '', 'logs:edge-functions', '--from', '2026-01-01T00:00:00Z'])

      expect(spyWebsocket).not.toHaveBeenCalled()
      const analyticsCall = spyFetch.mock.calls.find((args: string[]) =>
        args[0].includes('analytics.services.netlify.com'),
      )
      expect(analyticsCall).toBeDefined()
      expect(analyticsCall![0]).toContain('edge_function_logs')
      expect(analyticsCall![0]).toContain('site_id')
    } finally {
      global.fetch = originalFetch
    }
  })
})
