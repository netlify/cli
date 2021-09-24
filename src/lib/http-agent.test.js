const http = require('http')

const test = require('ava')
const { createProxyServer } = require('http-proxy')
const { HttpsProxyAgent } = require('https-proxy-agent')

const { tryGetAgent } = require('./http-agent')

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
  const proxy = createProxyServer()
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
