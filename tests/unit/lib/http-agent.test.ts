import net from 'node:net'
import http from 'node:http'
import https from 'node:https'

import ProxyServer from 'http-proxy'
import { HttpsProxyAgent } from 'https-proxy-agent'
import nodeFetch from 'node-fetch'
import { getGlobalDispatcher, setGlobalDispatcher } from 'undici'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { getAgent, tryGetAgent } from '../../../src/lib/http-agent.js'

const listen = async (server: net.Server): Promise<number> => {
  await new Promise<void>((resolve) => {
    server.listen({ port: 0, hostname: 'localhost' }, () => {
      resolve()
    })
  })
  return (server.address() as net.AddressInfo).port
}

const close = (server: net.Server) =>
  new Promise<void>((resolve) => {
    server.close(() => {
      resolve()
    })
  })

/**
 * Starts a server that responds with `target`, and a proxy that records the requests it receives
 * and sends them to that server, no matter which host they are for.
 */
const startProxy = async () => {
  const target = http.createServer((_, res) => {
    res.end('target')
  })
  const targetPort = await listen(target)

  const proxiedRequests: string[] = []
  const proxy = http.createServer((req, res) => {
    proxiedRequests.push(req.url ?? '')
    res.end('target')
  })
  proxy.on('connect', (req: http.IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
    proxiedRequests.push(req.url ?? '')
    const targetSocket = net.connect(targetPort, 'localhost', () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      targetSocket.write(head)
      targetSocket.pipe(clientSocket)
      clientSocket.pipe(targetSocket)
    })
  })
  const proxyPort = await listen(proxy)

  return {
    httpProxy: `http://localhost:${proxyPort.toString()}`,
    proxiedRequests,
    targetUrl: `http://localhost:${targetPort.toString()}/`,
    close: async () => {
      proxy.closeAllConnections()
      target.closeAllConnections()
      await Promise.all([close(proxy), close(target)])
    },
  }
}

describe('tryGetAgent', () => {
  test(`should return an empty object when there is no httpProxy`, async () => {
    expect(await tryGetAgent({})).toEqual({})
  })

  test(`should return error on invalid url`, async () => {
    const httpProxy = 'invalid_url'
    const result = await tryGetAgent({ httpProxy })

    expect(result).toHaveProperty('error', expect.any(String))
  })

  test(`should return error when scheme is not http or https`, async () => {
    const httpProxy = 'file://localhost'
    const result = await tryGetAgent({ httpProxy })

    expect(result).toHaveProperty('error', expect.any(String))
  })

  test(`should return error when proxy is not available`, async () => {
    const httpProxy = 'https://unknown:7979'
    const result = await tryGetAgent({ httpProxy })

    expect(result).toHaveProperty('error', expect.any(String))
  })

  test(`should return agent for a valid proxy`, async () => {
    const proxy = ProxyServer.createProxyServer()
    const server = http.createServer(function onRequest(req, res) {
      proxy.web(req, res, { target: 'http://localhost:5555' })
    })

    await new Promise<void>((resolve) => {
      server.listen({ port: 0, hostname: 'localhost' }, () => {
        resolve()
      })
    })

    const httpProxyUrl = `http://localhost:${(server.address() as net.AddressInfo).port.toString()}`
    const result = await tryGetAgent({ httpProxy: httpProxyUrl })

    if (!('agent' in result)) {
      throw new Error('expected result to include agent')
    }
    expect(result.agent).toBeInstanceOf(HttpsProxyAgent)

    server.close()
  })
})

// https://github.com/netlify/cli/issues/3115
describe('global proxy support', () => {
  const originalDispatcher = getGlobalDispatcher()
  const originalHttpsGlobalAgent = https.globalAgent
  const originalNoProxy = process.env.NO_PROXY
  const originalLowercaseNoProxy = process.env.no_proxy
  let proxy: Awaited<ReturnType<typeof startProxy>>

  const restoreEnv = (name: string, value: string | undefined) => {
    if (value === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete process.env[name]
    } else {
      process.env[name] = value
    }
  }

  beforeEach(async () => {
    delete process.env.NO_PROXY
    delete process.env.no_proxy
    proxy = await startProxy()
  })

  afterEach(async () => {
    setGlobalDispatcher(originalDispatcher)
    https.globalAgent = originalHttpsGlobalAgent
    restoreEnv('NO_PROXY', originalNoProxy)
    restoreEnv('no_proxy', originalLowercaseNoProxy)
    await proxy.close()
  })

  test('getAgent sends global fetch requests through the proxy', async () => {
    await getAgent({ httpProxy: proxy.httpProxy, certificateFile: undefined })

    const response = await fetch('http://netlify-cli-test.invalid/path')

    expect(await response.text()).toBe('target')
    expect(proxy.proxiedRequests).toHaveLength(1)
    expect(proxy.proxiedRequests[0]).toContain('netlify-cli-test.invalid')
  })

  // e.g. the Netlify API client that `@netlify/config` creates, which uses `node-fetch` without an agent
  test('getAgent sends https requests without an agent through the proxy', async () => {
    await getAgent({ httpProxy: proxy.httpProxy, certificateFile: undefined })

    // The test proxy can't complete the TLS handshake, so only check that the request reached it
    await nodeFetch('https://netlify-cli-test.invalid/path').catch(() => undefined)

    expect(proxy.proxiedRequests).toEqual(['netlify-cli-test.invalid:443'])
  })

  test('does not send requests to the local machine through the proxy', async () => {
    await getAgent({ httpProxy: proxy.httpProxy, certificateFile: undefined })

    const response = await fetch(proxy.targetUrl)

    expect(await response.text()).toBe('target')
    expect(proxy.proxiedRequests).toEqual([])
  })

  test('does not send requests to hosts in NO_PROXY through the proxy', async () => {
    process.env.NO_PROXY = 'netlify-cli-test.invalid'
    await getAgent({ httpProxy: proxy.httpProxy, certificateFile: undefined })

    // The host doesn't exist, so the requests fail when they don't go through the proxy
    await fetch('http://netlify-cli-test.invalid/path').catch(() => undefined)
    await nodeFetch('https://netlify-cli-test.invalid/path').catch(() => undefined)
    await nodeFetch('https://api.netlify-cli-test.invalid/path').catch(() => undefined)

    expect(proxy.proxiedRequests).toEqual([])
  })
})
