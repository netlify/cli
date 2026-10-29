import type { NetlifyAPI } from '@netlify/api'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { streamDeploy } from '../../../../../src/commands/logs/sources/deploy.js'
import { followDeploy } from '../../../../../src/commands/deploy/remote/follow.js'
import { DeployStateError } from '../../../../../src/utils/deploy/util.js'

vi.mock('../../../../../src/commands/logs/sources/deploy.js', () => ({
  streamDeploy: vi.fn(),
}))

const stopStreaming = vi.fn()

const createApi = (...states: string[]) => {
  const getSiteDeploy = vi.fn()
  for (const state of states) {
    getSiteDeploy.mockResolvedValueOnce({ id: 'deploy_id', state, error_message: 'Build failed' })
  }
  return { accessToken: 'token', getSiteDeploy } as unknown as NetlifyAPI
}

const follow = (api: NetlifyAPI, onLogLine?: (line: string) => void) =>
  followDeploy(api, { siteId: 'site_id', deployId: 'deploy_id', timeoutMs: 5_000, onLogLine })

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.mocked(streamDeploy).mockReturnValue(stopStreaming)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('followDeploy', () => {
  test('resolves with the deploy once it is ready, streaming its log meanwhile', async () => {
    const onLogLine = vi.fn()
    vi.mocked(streamDeploy).mockImplementation((_siteId, _deployId, _token, onEntry) => {
      onEntry({ source: 'deploy', name: 'deploy', ts: 0, level: 'INFO', message: 'Installing dependencies' })
      return stopStreaming
    })

    const result = follow(createApi('building', 'ready'), onLogLine)
    await vi.runAllTimersAsync()

    await expect(result).resolves.toMatchObject({ state: 'ready' })
    expect(onLogLine).toHaveBeenCalledWith('Installing dependencies')
    expect(streamDeploy).toHaveBeenCalledWith(
      'site_id',
      'deploy_id',
      'token',
      expect.any(Function),
      expect.any(Function),
    )
    expect(stopStreaming).toHaveBeenCalledOnce()
  })

  test('does not stream without a log handler', async () => {
    await follow(createApi('ready'))

    expect(streamDeploy).not.toHaveBeenCalled()
  })

  test('stops streaming when the deploy fails', async () => {
    const result = follow(createApi('building', 'error'), vi.fn())
    await Promise.all([expect(result).rejects.toThrow(DeployStateError), vi.runAllTimersAsync()])

    await expect(result).rejects.toThrow('Build failed')
    expect(stopStreaming).toHaveBeenCalledOnce()
  })
})
