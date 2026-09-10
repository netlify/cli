import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import process from 'node:process'

import { NetlifyAPI } from '@netlify/api'
import { afterEach, expect, test, vi } from 'vitest'

import { getDropToken } from '../../../src/utils/deploy/drop-api.js'
import { netlifyFetch } from '../../../src/utils/netlify-fetch.js'
import { USER_AGENT, getRequestUserAgent } from '../../../src/utils/user-agent.js'
import { getWebSocket } from '../../../src/utils/websockets/index.js'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const captureUserAgent = async (sendRequest: (origin: string) => Promise<unknown>) => {
  let resolveUserAgent: (userAgent: string | undefined) => void = () => {}
  const received = new Promise<string | undefined>((resolve) => {
    resolveUserAgent = resolve
  })
  const server = createServer((req, res) => {
    resolveUserAgent(req.headers['user-agent'])
    res.setHeader('Content-Type', 'application/json')
    res.end('{}')
  })
  server.on('upgrade', (req, socket) => {
    resolveUserAgent(req.headers['user-agent'])
    socket.destroy()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  try {
    await sendRequest(`http://127.0.0.1:${String(port)}`)
    return await received
  } finally {
    server.closeAllConnections()
    server.close()
  }
}

const sendViaApiClient = (origin: string) =>
  new NetlifyAPI('', {
    userAgent: getRequestUserAgent(),
    scheme: 'http',
    host: new URL(origin).host,
    pathPrefix: '/api/v1',
  }).listSites()

const sendViaDropApi = (origin: string) => getDropToken({ apiBase: origin })

const sendViaNetlifyFetch = (origin: string) => netlifyFetch(`${origin}/api/v1/sites`)

const sendViaWebSocket = (origin: string) =>
  new Promise<void>((resolve) => {
    getWebSocket(origin.replace('http', 'ws')).on('error', () => {
      resolve()
    })
  })

const sendViaTelemetryRequest = async (origin: string) => {
  const exited = new Promise<void>((resolve) => {
    vi.spyOn(process, 'exit').mockImplementation(() => {
      resolve()
      return undefined as never
    })
  })
  vi.stubEnv('NETLIFY_TEST_TRACK_URL', `${origin}/track`)
  const { argv } = process
  process.argv = [...argv.slice(0, 2), JSON.stringify({ type: 'track', data: {} })]

  try {
    await import('../../../src/utils/telemetry/request.js')
  } finally {
    process.argv = argv
  }
  await exited
}

test('every Netlify request path sends the same User-Agent', async () => {
  vi.stubEnv('NETLIFY_AGENT', 'claude')

  const userAgents = [
    await captureUserAgent(sendViaApiClient),
    await captureUserAgent(sendViaDropApi),
    await captureUserAgent(sendViaTelemetryRequest),
    await captureUserAgent(sendViaNetlifyFetch),
    await captureUserAgent(sendViaWebSocket),
  ]

  expect(userAgents).toEqual(Array(5).fill(`${USER_AGENT} agent/claude`))
})

test('appends only the agent name, without its version or source', () => {
  expect(getRequestUserAgent({ AI_AGENT: 'claude-code@2.1.0' })).toBe(`${USER_AGENT} agent/claude`)
})

test('leaves the User-Agent unchanged when no agent is detected', () => {
  expect(getRequestUserAgent({})).toBe(USER_AGENT)
})
