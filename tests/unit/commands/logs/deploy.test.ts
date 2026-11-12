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

const { fetchDeployHistoricalLogs, findLatestFinishedDeploy, findLatestReadyDeploy, isDeployFinished, streamDeploy } =
  await import('../../../../src/commands/logs/sources/deploy.js')

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

describe('deploy selection', () => {
  it('findLatestFinishedDeploy returns the newest finished deploy, including failed ones', async () => {
    const listSiteDeploys = vi.fn().mockResolvedValue([{ id: 'failed-deploy', state: 'error' }])
    const client = { listSiteDeploys } as never

    const id = await findLatestFinishedDeploy(client, 'site-1')

    expect(id).toBe('failed-deploy')
    expect(listSiteDeploys).toHaveBeenCalledWith({ siteId: 'site-1', per_page: 10 })
  })

  it('findLatestFinishedDeploy skips in-progress builds', async () => {
    const listSiteDeploys = vi.fn().mockResolvedValue([
      { id: 'building-deploy', state: 'building' },
      { id: 'enqueued-deploy', state: 'enqueued' },
      { id: 'ready-deploy', state: 'ready' },
    ])
    const client = { listSiteDeploys } as never

    expect(await findLatestFinishedDeploy(client, 'site-1')).toBe('ready-deploy')
  })

  it('findLatestFinishedDeploy treats cancelled deploys as finished', async () => {
    const listSiteDeploys = vi.fn().mockResolvedValue([
      { id: 'building-deploy', state: 'building' },
      { id: 'cancelled-deploy', state: 'cancelled' },
    ])
    const client = { listSiteDeploys } as never

    expect(await findLatestFinishedDeploy(client, 'site-1')).toBe('cancelled-deploy')
  })

  it('findLatestReadyDeploy filters to ready deploys only', async () => {
    const listSiteDeploys = vi.fn().mockResolvedValue([{ id: 'ready-deploy', state: 'ready' }])
    const client = { listSiteDeploys } as never

    const id = await findLatestReadyDeploy(client, 'site-1')

    expect(id).toBe('ready-deploy')
    expect(listSiteDeploys).toHaveBeenCalledWith({ siteId: 'site-1', state: 'ready', per_page: 1 })
  })

  it('returns undefined when there are no finished deploys', async () => {
    const client = {
      listSiteDeploys: vi.fn().mockResolvedValue([{ id: 'building-deploy', state: 'building' }]),
    } as never
    expect(await findLatestFinishedDeploy(client, 'site-1')).toBeUndefined()
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

  it('closes after going idle when closeWhenIdleMs is set', () => {
    vi.useFakeTimers()
    try {
      const onClose = vi.fn()
      streamDeploy('site-1', 'deploy-1', 'token-1', vi.fn(), onClose, { closeWhenIdleMs: 3_000 })
      const [ws] = sockets

      ws.emit('open')
      ws.emit('message', JSON.stringify({ ts: '2026-01-01T00:05:00.000Z', message: 'replayed line' }))
      expect(ws.closed).toBe(false)

      vi.advanceTimersByTime(3_000)
      expect(ws.closed).toBe(true)
      expect(onClose).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not arm the short idle timer until the first message arrives', () => {
    vi.useFakeTimers()
    try {
      streamDeploy('site-1', 'deploy-1', 'token-1', vi.fn(), vi.fn(), { closeWhenIdleMs: 3_000 })
      const [ws] = sockets

      ws.emit('open')
      // a slow first message (longer than the idle window) must not close the stream early
      vi.advanceTimersByTime(10_000)
      expect(ws.closed).toBe(false)

      ws.emit('message', JSON.stringify({ message: 'first line' }))
      vi.advanceTimersByTime(3_000)
      expect(ws.closed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('closes after the start timeout when no message ever arrives', () => {
    vi.useFakeTimers()
    try {
      streamDeploy('site-1', 'deploy-1', 'token-1', vi.fn(), vi.fn(), { closeWhenIdleMs: 3_000 })
      const [ws] = sockets

      ws.emit('open')
      vi.advanceTimersByTime(20_000)

      expect(ws.closed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('closes after the start timeout even if the socket never opens', () => {
    vi.useFakeTimers()
    try {
      streamDeploy('site-1', 'deploy-1', 'token-1', vi.fn(), vi.fn(), { closeWhenIdleMs: 3_000 })
      const [ws] = sockets

      vi.advanceTimersByTime(20_000)

      expect(ws.closed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('handles a socket error without throwing (e.g. closed while connecting)', () => {
    streamDeploy('site-1', 'deploy-1', 'token-1', vi.fn(), vi.fn(), { closeWhenIdleMs: 3_000 })
    const [ws] = sockets

    expect(() =>
      ws.emit('error', new Error('WebSocket was closed before the connection was established')),
    ).not.toThrow()
  })

  it('does not idle-close when closeWhenIdleMs is not set', () => {
    vi.useFakeTimers()
    try {
      streamDeploy('site-1', 'deploy-1', 'token-1', vi.fn(), vi.fn())
      const [ws] = sockets

      ws.emit('open')
      ws.emit('message', JSON.stringify({ message: 'live line' }))
      vi.advanceTimersByTime(60_000)

      expect(ws.closed).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('isDeployFinished', () => {
  it.each(['ready', 'error', 'cancelled'])('returns true for the %s state', async (state) => {
    const client = { getSiteDeploy: vi.fn().mockResolvedValue({ state }) } as never
    expect(await isDeployFinished(client, 'site-1', 'deploy-1')).toBe(true)
  })

  it('returns false for an in-progress deploy', async () => {
    const client = { getSiteDeploy: vi.fn().mockResolvedValue({ state: 'building' }) } as never
    expect(await isDeployFinished(client, 'site-1', 'deploy-1')).toBe(false)
  })
})
