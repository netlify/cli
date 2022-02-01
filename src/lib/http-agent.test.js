const http = require('http')

const { createProxyServer } = require('http-proxy')
const { HttpsProxyAgent } = require('https-proxy-agent')

const { tryGetAgent } = require('./http-agent')

test(`should return an empty object when there is no httpProxy`, async () => {
  expect(await tryGetAgent({})).toEqual({})
})

test(`should return error on invalid url`, async () => {
  const httpProxy = 'invalid_url'
  const result = await tryGetAgent({ httpProxy })
  expect(result.error).toBeTruthy()
})

test(`should return error when scheme is not http or https`, async () => {
  const httpProxy = 'file://localhost'
  const result = await tryGetAgent({ httpProxy })

  expect(result.error).toBeTruthy()
})

test(`should return error when proxy is not available`, async () => {
  const httpProxy = 'https://unknown:7979'
  const result = await tryGetAgent({ httpProxy })

  expect(result.error).toBeTruthy()
})

test(`should return agent for a valid proxy`, async () => {
  const proxy = createProxyServer()
  const server = http.createServer(function onRequest(req, res) {
    proxy.web(req, res, { target: 'http://localhost:5555' })
  })

  await new Promise((resolve) => {
    server.listen({ port: 0, hostname: 'localhost' }, resolve)
  })

  const httpProxyUrl = `http://localhost:${server.address().port}`
  const result = await tryGetAgent({ httpProxy: httpProxyUrl })

  expect(result.agent instanceof HttpsProxyAgent).toBe(true)

  server.close()
})
