import { Mock, afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createLogsFunctionCommand } from '../../../../src/commands/logs/index.js'
import { LOG_LEVELS } from '../../../../src/commands/logs/log-levels.js'
import { log } from '../../../../src/utils/command-helpers.js'
import { getWebSocket } from '../../../../src/utils/websockets/index.js'
import { startMockApi } from '../../utils/mock-api-vitest.ts'
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
    prompt: vi.fn().mockResolvedValue({ result: 'cool-function' }),
    registerPrompt: vi.fn(),
  },
}))

const siteInfo = {
  admin_url: 'https://app.netlify.com/sites/site-name/overview',
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
    const spyWebsocket = getWebSocket as unknown as Mock<any, any>
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
    const spyWebsocket = getWebSocket as unknown as Mock<any, any>
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

    const openCallback = setupCall[1]
    openCallback()

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
    const spyWebsocket = getWebSocket as unknown as Mock<any, any>
    const spyOn = vi.fn()
    const spySend = vi.fn()
    spyWebsocket.mockReturnValue({
      on: spyOn,
      send: spySend,
    })
    const spyLog = log as unknown as Mock<any, any>

    const env = getEnvironmentVariables({ apiUrl })
    Object.assign(process.env, env)

    await program.parseAsync(['', '', 'logs:function', '--level', 'info'])
    const messageCallback = spyOn.mock.calls.find((args) => args[0] === 'message')
    const messageCallbackFunc = messageCallback[1]
    const mockInfoData = {
      level: LOG_LEVELS.INFO,
      message: 'Hello World',
    }
    const mockWarnData = {
      level: LOG_LEVELS.WARN,
      message: 'There was a warning',
    }

    messageCallbackFunc(JSON.stringify(mockInfoData))
    messageCallbackFunc(JSON.stringify(mockWarnData))

    expect(spyLog).toHaveBeenCalledTimes(1)
  })

  test('should print all the log levels', async ({}) => {
    const { apiUrl } = await startMockApi({ routes })
    const spyWebsocket = getWebSocket as unknown as Mock<any, any>
    const spyOn = vi.fn()
    const spySend = vi.fn()
    spyWebsocket.mockReturnValue({
      on: spyOn,
      send: spySend,
    })
    const spyLog = log as unknown as Mock<any, any>

    const env = getEnvironmentVariables({ apiUrl })
    Object.assign(process.env, env)

    await program.parseAsync(['', '', 'logs:function'])
    const messageCallback = spyOn.mock.calls.find((args) => args[0] === 'message')
    const messageCallbackFunc = messageCallback[1]
    const mockInfoData = {
      level: LOG_LEVELS.INFO,
      message: 'Hello World',
    }
    const mockWarnData = {
      level: LOG_LEVELS.WARN,
      message: 'There was a warning',
    }

    messageCallbackFunc(JSON.stringify(mockInfoData))
    messageCallbackFunc(JSON.stringify(mockWarnData))

    expect(spyLog).toHaveBeenCalledTimes(2)
  })
})
