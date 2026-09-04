import { EventEmitter } from 'node:events'

import { beforeEach, describe, expect, it, vi } from 'vitest'

class FakeWebSocket extends EventEmitter {
  sent: string[] = []
  closed = false

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    if (this.closed) {
      return
    }
    this.closed = true
    this.emit('close')
  }
}

const sockets: FakeWebSocket[] = []
const getWebSocketMock = vi.fn((_url: string) => {
  const ws = new FakeWebSocket()
  sockets.push(ws)
  return ws
})

vi.mock('../../../../src/utils/websockets/index.js', () => ({
  getWebSocket: (url: string) => getWebSocketMock(url),
}))

const { fetchDeployHistoricalLogs, streamDeploy } = await import('../../../../src/commands/logs/sources/deploy.js')

const FROM = Date.parse('2026-01-01T00:00:00.000Z')
const TO = Date.parse('2026-01-01T00:10:00.000Z')

const drive = (ws: FakeWebSocket, messages: unknown[]) => {
  ws.emit('open')
  for (const message of messages) {
    ws.emit('message', JSON.stringify(message))
  }
}

beforeEach(() => {
  sockets.length = 0
  getWebSocketMock.mockClear()
})

describe('fetchDeployHistoricalLogs', () => {
  it('connects to socketeer and sends the deploy handshake', async () => {
    const promise = fetchDeployHistoricalLogs({
      siteId: 'site-1',
      accessToken: 'token-1',
      deployId: 'deploy-1',
      from: FROM,
      to: TO,
    })

    const [ws] = sockets
    drive(ws, [{ type: 'report', section: 'building' }])
    await promise

    expect(getWebSocketMock).toHaveBeenCalledWith('wss://socketeer.services.netlify.com/build/logs')
    expect(JSON.parse(ws.sent[0])).toEqual({
      deploy_id: 'deploy-1',
      site_id: 'site-1',
      access_token: 'token-1',
    })
  })

  it('replays stored build logs as sorted deploy entries', async () => {
    const promise = fetchDeployHistoricalLogs({
      siteId: 'site-1',
      accessToken: 'token-1',
      deployId: 'deploy-1',
      from: FROM,
      to: TO,
    })

    drive(sockets[0], [
      { ts: '2026-01-01T00:05:00.000Z', log: 'second', level: 'INFO', section: 'building' },
      { ts: '2026-01-01T00:02:00.000Z', message: 'first', level: 'WARNING', section: 'initializing' },
      { type: 'report', section: 'building' },
    ])
    const entries = await promise

    expect(entries.map((entry) => entry.message)).toEqual(['first', 'second'])
    expect(entries[0]).toMatchObject({ source: 'deploy', name: 'deploy', level: 'WARNING', section: 'initializing' })
  })

  it('drops timestamped lines outside the requested window but keeps untimestamped build lines', async () => {
    const promise = fetchDeployHistoricalLogs({
      siteId: 'site-1',
      accessToken: 'token-1',
      deployId: 'deploy-1',
      from: FROM,
      to: TO,
    })

    drive(sockets[0], [
      { ts: '2025-06-01T00:00:00.000Z', log: 'too old' },
      { ts: '2026-01-01T00:05:00.000Z', log: 'in range' },
      { log: 'no timestamp' },
      { type: 'report', section: 'building' },
    ])
    const entries = await promise

    const messages = entries.map((entry) => entry.message)
    expect(messages).toContain('in range')
    expect(messages).toContain('no timestamp')
    expect(messages).not.toContain('too old')
  })

  it('parses numeric epoch-millisecond timestamps', async () => {
    const promise = fetchDeployHistoricalLogs({
      siteId: 'site-1',
      accessToken: 'token-1',
      deployId: 'deploy-1',
      from: FROM,
      to: TO,
    })

    drive(sockets[0], [
      { ts: Date.parse('2026-01-01T00:05:00.000Z'), log: 'numeric ts' },
      { type: 'report', section: 'building' },
    ])
    const entries = await promise

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ message: 'numeric ts', ts: Date.parse('2026-01-01T00:05:00.000Z') })
  })

  it('ignores malformed messages without throwing', async () => {
    const promise = fetchDeployHistoricalLogs({
      siteId: 'site-1',
      accessToken: 'token-1',
      deployId: 'deploy-1',
      from: FROM,
      to: TO,
    })

    const [ws] = sockets
    ws.emit('open')
    ws.emit('message', 'not-json')
    ws.emit('message', JSON.stringify({ ts: '2026-01-01T00:05:00.000Z', log: 'valid' }))
    ws.emit('message', JSON.stringify({ type: 'report', section: 'building' }))
    const entries = await promise

    expect(entries.map((entry) => entry.message)).toEqual(['valid'])
  })

  it('skips null and non-object frames without throwing', async () => {
    const promise = fetchDeployHistoricalLogs({
      siteId: 'site-1',
      accessToken: 'token-1',
      deployId: 'deploy-1',
      from: FROM,
      to: TO,
    })

    drive(sockets[0], [
      null,
      42,
      'a string',
      ['an', 'array'],
      { ts: '2026-01-01T00:05:00.000Z', log: 'valid' },
      { type: 'report', section: 'building' },
    ])
    const entries = await promise

    expect(entries.map((entry) => entry.message)).toEqual(['valid'])
  })

  it('resolves when the socket closes without a terminal report', async () => {
    const promise = fetchDeployHistoricalLogs({
      siteId: 'site-1',
      accessToken: 'token-1',
      deployId: 'deploy-1',
      from: FROM,
      to: TO,
    })

    const [ws] = sockets
    ws.emit('open')
    ws.emit('message', JSON.stringify({ ts: '2026-01-01T00:05:00.000Z', log: 'partial' }))
    ws.close()
    const entries = await promise

    expect(entries.map((entry) => entry.message)).toEqual(['partial'])
  })

  it('rejects the replay promise on socket error', async () => {
    const promise = fetchDeployHistoricalLogs({
      siteId: 'site-1',
      accessToken: 'token-1',
      deployId: 'deploy-1',
      from: FROM,
      to: TO,
    })

    const [ws] = sockets
    ws.emit('open')
    ws.emit('error', new Error('connection refused'))

    await expect(promise).rejects.toThrow('connection refused')
  })
})

describe('streamDeploy', () => {
  it('streams entries and closes on the terminal build report', () => {
    const onEntry = vi.fn()
    const onClose = vi.fn()

    streamDeploy('site-1', 'deploy-1', 'token-1', onEntry, onClose)
    const [ws] = sockets

    ws.emit('open')
    ws.emit('message', JSON.stringify({ ts: '2026-01-01T00:05:00.000Z', message: 'live line', level: 'INFO' }))
    expect(onEntry).toHaveBeenCalledWith(expect.objectContaining({ source: 'deploy', message: 'live line' }))
    expect(ws.closed).toBe(false)

    ws.emit('message', JSON.stringify({ type: 'report', section: 'building' }))
    expect(ws.closed).toBe(true)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
