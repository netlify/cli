const http = require('http')

const test = require('ava')
const { createProxyServer } = require('http-proxy')
const { HttpsProxyAgent } = require('https-proxy-agent')
const sinon = require('sinon')

const { getAgent } = require('./http-agent')

test(`should return undefined when there is no httpProxy`, async (t) => {
  t.is(undefined, await getAgent({}))
})

test(`should exit with error on invalid url`, async (t) => {
  const httpProxy = 'invalid_url'
  const exit = sinon.stub()
  exit.withArgs(1).throws('error')

  await t.throwsAsync(getAgent({ httpProxy, exit }))
})

test(`should exit with error on when scheme is not http or https`, async (t) => {
  const httpProxy = 'file://localhost'
  const exit = sinon.stub()
  exit.withArgs(1).throws('error')

  await t.throwsAsync(getAgent({ httpProxy, exit }))
})

test(`should exit with error when proxy is not available`, async (t) => {
  const httpProxy = 'https://unknown:7979'
  const exit = sinon.stub()
  exit.withArgs(1).throws('error')

  await t.throwsAsync(getAgent({ httpProxy, exit }))
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
  const exit = sinon.stub()
  exit.withArgs(1).throws('error')

  const agent = await getAgent({ httpProxy: httpProxyUrl, exit })

  t.is(agent instanceof HttpsProxyAgent, true)

  server.close()
})
