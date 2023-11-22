import { http, HttpResponse } from 'msw'
import { Mock, afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { getWebSocket } from '../../../../src/utils/websockets/index.js'
import { addMockedFiles } from '../../../fs.js'
import { server } from '../../../server.js'

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

describe('logs:deploy command', () => {
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
      http.get('https://api.netlify.com/api/v1/sites/:site_id/deploys', () =>
        HttpResponse.json([
          {
            state: 'building',
            context: 'production',
            id: 'deploy-id',
          },
        ]),
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

  test('should setup the deploy stream correctly', async ({ callCli }) => {
    const spyWebsocket = getWebSocket as unknown as Mock<any, any>
    const spyOn = vi.fn()
    const spySend = vi.fn()
    spyWebsocket.mockReturnValue({
      on: spyOn,
      send: spySend,
    })

    await callCli(['logs:deploy'])

    expect(spyWebsocket).toHaveBeenCalledOnce()
    expect(spyOn).toHaveBeenCalledTimes(3)
  })

  test('should send the correct payload to the websocket', async ({ callCli }) => {
    const spyWebsocket = getWebSocket as unknown as Mock<any, any>
    const spyOn = vi.fn()
    const spySend = vi.fn()
    spyWebsocket.mockReturnValue({
      on: spyOn,
      send: spySend,
    })

    await callCli(['logs:deploy'])

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
    expect(body.access_token).toEqual('test-token')
  })
})
