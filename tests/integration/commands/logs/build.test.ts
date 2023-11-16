import { Mock, afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createLogsBuildCommand } from '../../../../src/commands/logs/build.js'
import { getWebSocket } from '../../../../src/utils/websockets/index.js'
import { startMockApi } from '../../utils/mock-api-vitest.js'
import { getEnvironmentVariables } from '../../utils/mock-api.js'

vi.mock('../../../../src/utils/websockets/index.js', () => ({
  getWebSocket: vi.fn(),
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
    path: 'sites/site_id/deploys',
    response: [
      {
        state: 'building',
        context: 'production',
        id: 'deploy-id',
      },
    ],
  },
]

describe('logs:deploy command', () => {
  let program: BaseCommand

  afterEach(() => {
    vi.clearAllMocks()
  })

  beforeEach(() => {
    program = new BaseCommand('netlify')

    createLogsBuildCommand(program)
  })

  test('should setup the deploy stream correctly', async ({}) => {
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

    await program.parseAsync(['', '', 'logs:deploy'])

    expect(spyWebsocket).toHaveBeenCalledOnce()
    expect(spyOn).toHaveBeenCalledTimes(3)
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

    await program.parseAsync(['', '', 'logs:deploy'])

    const setupCall = spyOn.mock.calls.find((args) => args[0] === 'open')
    expect(setupCall).toBeDefined()

    const openCallback = setupCall[1]
    openCallback()

    expect(spySend).toHaveBeenCalledOnce()
    const call = spySend.mock.calls[0]
    const [message] = call
    const body = JSON.parse(message)

    expect(body.deploy_id).toEqual('deploy-id')
    expect(body.site_id).toEqual('site_id')
    expect(body.access_token).toEqual(env.NETLIFY_AUTH_TOKEN)
  })
})
