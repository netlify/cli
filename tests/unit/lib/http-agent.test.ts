import net from 'node:net'
import http from 'node:http'

import ProxyServer from 'http-proxy'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { describe, expect, test } from 'vitest'

import { tryGetAgent } from '../../../src/lib/http-agent.js'

describe('tryGetAgent', () => {
  test(`should return an empty object when there is no httpProxy`, async () => {
    expect(await tryGetAgent({})).toBeUndefined()
  })

  test(`should return error on invalid url`, async () => {
    const httpProxy = 'invalid_url'
    const result = await tryGetAgent({ httpProxy })

    expect(result).toHaveProperty('error')
  })

  test(`should return error when scheme is not http or https`, async () => {
    const httpProxy = 'file://localhost'
    const result = await tryGetAgent({ httpProxy })

    expect(result).toHaveProperty('error')
  })

  test(`should return error when proxy is not available`, async () => {
    const httpProxy = 'https://unknown:7979'
    const result = await tryGetAgent({ httpProxy })

    expect(result).toHaveProperty('error')
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

    if (!result || !('agent' in result)) {
      throw new Error('expected result to include agent')
    }
    expect(result.agent).toBeInstanceOf(HttpsProxyAgent)

    server.close()
  })
})
