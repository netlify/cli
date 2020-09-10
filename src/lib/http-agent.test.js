const test = require('ava')
const sinon = require('sinon')
const http = require('http')
const httpProxy = require('http-proxy')
const { HttpsProxyAgent } = require('https-proxy-agent')
const { getAgent } = require('./http-agent')

test(`should return undefined when there is no httpProxy`, async t => {
  t.is(undefined, await getAgent({}))
})

test(`should exit with error on invalid url`, async t => {
  const httpProxy = 'invalid_url'
  const log = sinon.stub()
  const exit = sinon.stub()
  exit.withArgs(1).throws('error')

  await t.throwsAsync(getAgent({ httpProxy, log, exit }))

  t.is('invalid_url is not a valid URL', log.getCall(0).args[1])
})

test(`should exit with error on when scheme is not http or https`, async t => {
  const httpProxy = 'file://localhost'
  const log = sinon.stub()
  const exit = sinon.stub()
  exit.withArgs(1).throws('error')

  await t.throwsAsync(getAgent({ httpProxy, log, exit }))

  t.is('file://localhost must have a scheme of http or https', log.getCall(0).args[1])
})

test(`should exit with error when proxy is no available`, async t => {
  const httpProxy = 'https://unknown:7979'
  const log = sinon.stub()
  const exit = sinon.stub()
  exit.withArgs(1).throws('error')

  await t.throwsAsync(getAgent({ httpProxy, log, exit }))

  if (process.platform === 'win32') {
    t.is("Could not connect to 'https://unknown:7979'", log.getCall(0).args[1])
  } else {
    t.is('https://unknown:7979 is not available.', log.getCall(0).args[1])
  }
})

test(`should return agent for a valid proxy`, async t => {
  const proxy = httpProxy.createProxyServer()
  const server = http.createServer(function(req, res) {
    proxy.web(req, res, { target: 'http://localhost:5555' })
  })

  await new Promise(resolve => {
    server.listen({ port: 0, hostname: 'localhost' }, resolve)
  })

  const httpProxyUrl = `http://localhost:${server.address().port}`
  const log = sinon.stub()
  const exit = sinon.stub()
  exit.withArgs(1).throws('error')

  const agent = await getAgent({ httpProxy: httpProxyUrl, log, exit })

  t.is(true, agent instanceof HttpsProxyAgent)

  server.close()
})
