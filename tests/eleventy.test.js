const path = require('path')

const { startDevServer } = require('./utils/dev-server')
const got = require('./utils/got')

let server

beforeAll(async () => {
  server = await startDevServer({ cwd: path.join(__dirname, 'eleventy-site') })
})

afterAll(async () => {
  await server.close()
})

test('homepage', async () => {
  const { url } = server
  const response = await got(`${url}/`).text()

  expect(response.includes('Eleventy Site')).toBe(true)
})

test('redirect test', async () => {
  const { url } = server
  const { body, headers, statusCode } = await got(`${url}/something`, { followRedirect: false })

  expect(statusCode).toBe(301)
  expect(headers.location).toBe(`/otherthing`)
  expect(body).toBe('Redirecting to /otherthing')
})

// TODO: un-skip this once https://github.com/netlify/cli/issues/1242 is fixed
test.skip('normal rewrite', async () => {
  const { url } = server
  const { body, headers, statusCode } = await got(`${url}/doesnt-exist`)

  expect(statusCode).toBe(200)
  expect(headers['content-type'].startsWith('text/html')).toBe(true)
  expect(body.includes('Eleventy Site')).toBe(true)
})

test('force rewrite', async () => {
  const { url } = server
  const { body, headers, statusCode } = await got(`${url}/force`)

  expect(statusCode).toBe(200)
  expect(headers['content-type'].startsWith('text/html')).toBe(true)
  expect(body.includes('<h1>Test content</h1>')).toBe(true)
})

test('functions rewrite echo without body', async () => {
  const { host, port, url } = server
  const response = await got(`${url}/api/echo?ding=dong`).json()

  expect(response.body).toBe(undefined)
  expect(response.headers).toEqual({
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate, br',
    'client-ip': '127.0.0.1',
    connection: 'close',
    host: `${host}:${port}`,
    'user-agent': 'got (https://github.com/sindresorhus/got)',
    'x-forwarded-for': '::ffff:127.0.0.1',
  })
  expect(response.httpMethod).toBe('GET')
  expect(response.isBase64Encoded).toBe(true)
  expect(response.path).toBe('/api/echo')
  expect(response.queryStringParameters).toEqual({ ding: 'dong' })
})

test('functions rewrite echo with body', async () => {
  const { host, port, url } = server
  const response = await got
    .post(`${url}/api/echo?ding=dong`, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'some=thing',
    })
    .json()

  expect(response.body).toBe('some=thing')
  expect(response.headers).toEqual({
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate, br',
    'client-ip': '127.0.0.1',
    connection: 'close',
    host: `${host}:${port}`,
    'content-type': 'application/x-www-form-urlencoded',
    'content-length': '10',
    'user-agent': 'got (https://github.com/sindresorhus/got)',
    'x-forwarded-for': '::ffff:127.0.0.1',
  })
  expect(response.httpMethod).toBe('POST')
  expect(response.isBase64Encoded).toBe(false)
  expect(response.path).toBe('/api/echo')
  expect(response.queryStringParameters).toEqual({ ding: 'dong' })
})

test('functions echo with multiple query params', async () => {
  const { host, port, url } = server
  const response = await got(`${url}/.netlify/functions/echo?category=a&category=b`).json()

  expect(response.headers).toEqual({
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate, br',
    'client-ip': '127.0.0.1',
    connection: 'close',
    host: `${host}:${port}`,
    'user-agent': 'got (https://github.com/sindresorhus/got)',
    'x-forwarded-for': '::ffff:127.0.0.1',
  })
  expect(response.httpMethod).toBe('GET')
  expect(response.isBase64Encoded).toBe(true)
  expect(response.path).toBe('/.netlify/functions/echo')
  expect(response.queryStringParameters).toEqual({ category: 'a, b' })
  expect(response.multiValueQueryStringParameters).toEqual({ category: ['a', 'b'] })
})
