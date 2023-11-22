import { http, HttpResponse } from 'msw'
import { Mock, afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { LOG_LEVELS } from '../../../../src/commands/logs/functions.js'
import { getWebSocket } from '../../../../src/utils/websockets/index.js'
import { addMockedFiles } from '../../../fs.ts'
import { server } from '../../../server.ts'

vi.mock('../../../../src/utils/websockets/index.js', () => ({
  getWebSocket: vi.fn(),
}))

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

describe('logs:function command', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  beforeEach(() => {
    server.use(
      http.get('https://api.netlify.com/api/v1/accounts', () => HttpResponse.json([{ slug: 'test-account' }])),
      http.get('https://api.netlify.com/api/v1/sites', () => HttpResponse.json([])),
      http.get('https://api.netlify.com/api/v1/sites/:site_id', () => HttpResponse.json(siteInfo)),
      http.get('https://api.netlify.com/api/v1/sites/:site_id/service-instances', () => HttpResponse.json([])),
      http.get('https://api.netlify.com/api/v1/user', () =>
        HttpResponse.json({ name: 'test user', slug: 'test-user', email: 'user@test.com' }),
      ),
      http.get('https://api.netlify.com/api/v1/sites/:site_id/functions', () =>
        HttpResponse.json({
          functions: [
            {
              // eslint-disable-next-line id-length
              n: 'cool-function',
              // eslint-disable-next-line id-length
              a: 'account',
              oid: 'function-id',
            },
          ],
        }),
      ),
    )

    addMockedFiles({
      '.netlify': {
        'state.json': JSON.stringify({
          siteId: 'site_id',
        }),
      },
    })
  })

  test('should setup the functions stream correctly', async ({ callCli }) => {
    const spyWebsocket = getWebSocket as unknown as Mock<any, any>
    const spyOn = vi.fn()
    const spySend = vi.fn()
    spyWebsocket.mockReturnValue({
      on: spyOn,
      send: spySend,
    })

    await callCli(['logs:function'])

    expect(spyWebsocket).toHaveBeenCalledOnce()
    expect(spyOn).toHaveBeenCalledTimes(4)
  })

  test('should send the correct payload to the websocket', async ({ callCli }) => {
    const spyWebsocket = getWebSocket as unknown as Mock<any, any>
    const spyOn = vi.fn()
    const spySend = vi.fn()
    spyWebsocket.mockReturnValue({
      on: spyOn,
      send: spySend,
    })

    await callCli(['logs:function'])

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
    expect(body.access_token).toEqual('test-token')
  })

  test('should print only specified log levels', async ({ callCli }) => {
    const spyWebsocket = getWebSocket as unknown as Mock<any, any>
    const spyOn = vi.fn()
    const spySend = vi.fn()
    spyWebsocket.mockReturnValue({
      on: spyOn,
      send: spySend,
    })

    await callCli(['logs:function', '--level', 'info'])
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

    expect(global.stdOut).toContain('Hello World')
    expect(global.stdOut).not.toContain('There was a warning')
  })

  test('should print all the log levels', async ({ callCli }) => {
    const spyWebsocket = getWebSocket as unknown as Mock<any, any>
    const spyOn = vi.fn()
    const spySend = vi.fn()
    spyWebsocket.mockReturnValue({
      on: spyOn,
      send: spySend,
    })

    await callCli(['logs:function'])
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

    expect(global.stdOut).toContain('Hello World')
    expect(global.stdOut).toContain('There was a warning')
  })
})
