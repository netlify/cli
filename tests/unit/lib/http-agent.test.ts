import http from 'http'

// @ts-expect-error TS(1259) FIXME: Module '"/home/ndhoule/dev/src/github.com/netlify/... Remove this comment to see the full error message
import ProxyServer from 'http-proxy'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { describe, expect, test } from 'vitest'

import { tryGetAgent } from '../../../dist/lib/http-agent.js'

describe('tryGetAgent', () => {
  test(`should return an empty object when there is no httpProxy`, async () => {
    // @ts-expect-error TS(2345) FIXME: Argument of type '{}' is not assignable to paramet... Remove this comment to see the full error message
    expect(await tryGetAgent({})).toEqual({})
  })

  test(`should return error on invalid url`, async () => {
    const httpProxy = 'invalid_url'
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ httpProxy: string; }' is not a... Remove this comment to see the full error message
    const result = await tryGetAgent({ httpProxy })

    expect(result.error).toBeDefined()
  })

  test(`should return error when scheme is not http or https`, async () => {
    const httpProxy = 'file://localhost'
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ httpProxy: string; }' is not a... Remove this comment to see the full error message
    const result = await tryGetAgent({ httpProxy })

    expect(result.error).toBeDefined()
  })

  test(`should return error when proxy is not available`, async () => {
    const httpProxy = 'https://unknown:7979'
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ httpProxy: string; }' is not a... Remove this comment to see the full error message
    const result = await tryGetAgent({ httpProxy })

    expect(result.error).toBeDefined()
  })

  test(`should return agent for a valid proxy`, async () => {
    const proxy = ProxyServer.createProxyServer()
    const server = http.createServer(function onRequest(req, res) {
      proxy.web(req, res, { target: 'http://localhost:5555' })
    })

    await new Promise((resolve) => {
      server.listen({ port: 0, hostname: 'localhost' }, resolve)
    })

    const httpProxyUrl = `http://localhost:${server.address().port}`
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ httpProxy: string; }' is not a... Remove this comment to see the full error message
    const result = await tryGetAgent({ httpProxy: httpProxyUrl })

    // @ts-expect-error TS(2339) FIXME: Property 'agent' does not exist on type '{ error?:... Remove this comment to see the full error message
    expect(result.agent).toBeInstanceOf(HttpsProxyAgent)

    server.close()
  })
})
