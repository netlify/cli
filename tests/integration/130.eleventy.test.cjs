const path = require('path')

const test = require('ava')

const { clientIP, originalIP } = require('../lib/local-ip.cjs')

const { startDevServer } = require('./utils/dev-server.cjs')
const got = require('./utils/got.cjs')

test.before(async (t) => {
  const server = await startDevServer({ cwd: path.join(__dirname, '__fixtures__/eleventy-site') })

  t.context.server = server
})

test.after(async (t) => {
  const { server } = t.context
  await server.close()
})

test('homepage', async (t) => {
  const { url } = t.context.server
  const response = await got(`${url}/`).text()

  t.true(response.includes('Eleventy Site'))
})

test('redirect test', async (t) => {
  const { url } = t.context.server
  const { body, headers, statusCode } = await got(`${url}/something`, { followRedirect: false })

  t.is(statusCode, 301)
  t.is(headers.location, `/otherthing`)
  t.is(body, 'Redirecting to /otherthing')
})

// TODO: un-skip this once https://github.com/netlify/cli/issues/1242 is fixed
test.skip('normal rewrite', async (t) => {
  const { url } = t.context.server
  const { body, headers, statusCode } = await got(`${url}/doesnt-exist`)

  t.is(statusCode, 200)
  t.true(headers['content-type'].startsWith('text/html'))
  t.true(body.includes('Eleventy Site'))
})

test('force rewrite', async (t) => {
  const { url } = t.context.server
  const { body, headers, statusCode } = await got(`${url}/force`)

  t.is(statusCode, 200)
  t.true(headers['content-type'].startsWith('text/html'))
  t.true(body.includes('<h1>Test content</h1>'))
})

test('functions rewrite echo without body', async (t) => {
  const { host, port, url } = t.context.server
  const response = await got(`${url}/api/echo?ding=dong`).json()
  const { 'x-nf-request-id': requestID, ...headers } = response.headers

  t.is(response.body, undefined)
  t.deepEqual(headers, {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate, br',
    'client-ip': clientIP,
    connection: 'close',
    host: `${host}:${port}`,
    'user-agent': 'got (https://github.com/sindresorhus/got)',
    'x-forwarded-for': originalIP,
    'x-nf-account-id': '',
    'x-nf-client-connection-ip': clientIP,
    'x-nf-geo':
      '{"city":"San Francisco","country":{"code":"US","name":"United States"},"subdivision":{"code":"CA","name":"California"},"longitude":0,"latitude":0,"timezone":"UTC"}',
  })
  t.is(requestID.length, 26)
  t.is(response.httpMethod, 'GET')
  t.is(response.isBase64Encoded, true)
  t.is(response.path, '/api/echo')
  t.deepEqual(response.queryStringParameters, { ding: 'dong' })
})

test('functions rewrite echo with body', async (t) => {
  const { host, port, url } = t.context.server
  const response = await got
    .post(`${url}/api/echo?ding=dong`, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'some=thing',
    })
    .json()
  const { 'x-nf-request-id': requestID, ...headers } = response.headers

  t.is(response.body, 'some=thing')
  t.deepEqual(headers, {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate, br',
    'client-ip': clientIP,
    connection: 'close',
    host: `${host}:${port}`,
    'content-type': 'application/x-www-form-urlencoded',
    'content-length': '10',
    'user-agent': 'got (https://github.com/sindresorhus/got)',
    'x-forwarded-for': originalIP,
    'x-nf-account-id': '',
    'x-nf-client-connection-ip': clientIP,
    'x-nf-geo':
      '{"city":"San Francisco","country":{"code":"US","name":"United States"},"subdivision":{"code":"CA","name":"California"},"longitude":0,"latitude":0,"timezone":"UTC"}',
  })
  t.is(requestID.length, 26)
  t.is(response.httpMethod, 'POST')
  t.is(response.isBase64Encoded, false)
  t.is(response.path, '/api/echo')
  t.deepEqual(response.queryStringParameters, { ding: 'dong' })
})

test('functions echo with multiple query params', async (t) => {
  const { host, port, url } = t.context.server
  const response = await got(`${url}/.netlify/functions/echo?category=a&category=b`).json()
  const { 'x-nf-request-id': requestID, ...headers } = response.headers

  t.deepEqual(headers, {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate, br',
    'client-ip': clientIP,
    connection: 'close',
    host: `${host}:${port}`,
    'user-agent': 'got (https://github.com/sindresorhus/got)',
    'x-forwarded-for': originalIP,
    'x-nf-account-id': '',
    'x-nf-client-connection-ip': clientIP,
    'x-nf-geo':
      '{"city":"San Francisco","country":{"code":"US","name":"United States"},"subdivision":{"code":"CA","name":"California"},"longitude":0,"latitude":0,"timezone":"UTC"}',
  })
  t.is(requestID.length, 26)
  t.is(response.httpMethod, 'GET')
  t.is(response.isBase64Encoded, true)
  t.is(response.path, '/.netlify/functions/echo')
  t.deepEqual(response.queryStringParameters, { category: 'a, b' })
  t.deepEqual(response.multiValueQueryStringParameters, { category: ['a', 'b'] })
})
