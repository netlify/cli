import http from 'http'

import test from 'ava'
import ProxyServer from 'http-proxy'
import HttpsProxyAgent from 'https-proxy-agent'

import { tryGetAgent } from '../../../src/lib/http-agent.mjs'

test(`should return an empty object when there is no httpProxy`, async (t) => {
  t.deepEqual(await tryGetAgent({}), {})
})

test(`should return error on invalid url`, async (t) => {
  const httpProxy = 'invalid_url'
  const result = await tryGetAgent({ httpProxy })
  t.truthy(result.error)
})

test(`should return error when scheme is not http or https`, async (t) => {
  const httpProxy = 'file://localhost'
  const result = await tryGetAgent({ httpProxy })

  t.truthy(result.error)
})

test(`should return error when proxy is not available`, async (t) => {
  const httpProxy = 'https://unknown:7979'
  const result = await tryGetAgent({ httpProxy })

  t.truthy(result.error)
})

test(`should return agent for a valid proxy`, async (t) => {
  const proxy = ProxyServer.createProxyServer()
  const server = http.createServer(function onRequest(req, res) {
    proxy.web(req, res, { target: 'http://localhost:5555' })
  })

  await new Promise((resolve) => {
    server.listen({ port: 0, hostname: 'localhost' }, resolve)
  })

  const httpProxyUrl = `http://localhost:${server.address().port}`
  const result = await tryGetAgent({ httpProxy: httpProxyUrl })

  t.is(result.agent instanceof HttpsProxyAgent, true)

  server.close()
})
