const path = require('path')

const test = require('ava')

const { startDevServer } = require('./utils/dev-server')
const got = require('./utils/got')

test.before(async (t) => {
  const server = await startDevServer({
    cwd: path.join(__dirname, 'eleventy-site'),
    // required so configuration won't be resolved from the current CLI repo linked site
    args: ['--offline'],
  })

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
  const { body, statusCode, headers } = await got(`${url}/something`, { followRedirect: false })

  t.is(statusCode, 301)
  t.is(headers.location, `/otherthing`)
  t.is(body, 'Redirecting to /otherthing')
})

// TODO: un-skip this once https://github.com/netlify/cli/issues/1242 is fixed
test.skip('normal rewrite', async (t) => {
  const { url } = t.context.server
  const { body, statusCode, headers } = await got(`${url}/doesnt-exist`)

  t.is(statusCode, 200)
  t.true(headers['content-type'].startsWith('text/html'))
  t.true(body.includes('Eleventy Site'))
})

test('force rewrite', async (t) => {
  const { url } = t.context.server
  const { body, statusCode, headers } = await got(`${url}/force`)

  t.is(statusCode, 200)
  t.true(headers['content-type'].startsWith('text/html'))
  t.true(body.includes('<h1>Test content</h1>'))
})

test('functions rewrite echo without body', async (t) => {
  const { url, host, port } = t.context.server
  const response = await got(`${url}/api/echo?ding=dong`).json()

  t.is(response.body, undefined)
  t.deepEqual(response.headers, {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate, br',
    'client-ip': '127.0.0.1',
    connection: 'close',
    host: `${host}:${port}`,
    'user-agent': 'got (https://github.com/sindresorhus/got)',
    'x-forwarded-for': '::ffff:127.0.0.1',
  })
  t.is(response.httpMethod, 'GET')
  t.is(response.isBase64Encoded, false)
  t.is(response.path, '/api/echo')
  t.deepEqual(response.queryStringParameters, { ding: 'dong' })
})

test('functions rewrite echo with body', async (t) => {
  const { url, host, port } = t.context.server
  const response = await got
    .post(`${url}/api/echo?ding=dong`, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'some=thing',
    })
    .json()

  t.is(response.body, 'some=thing')
  t.deepEqual(response.headers, {
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
  t.is(response.httpMethod, 'POST')
  t.is(response.isBase64Encoded, false)
  t.is(response.path, '/api/echo')
  t.deepEqual(response.queryStringParameters, { ding: 'dong' })
})

test('functions echo with multiple query params', async (t) => {
  const { url, host, port } = t.context.server
  const response = await got(`${url}/.netlify/functions/echo?category=a&category=b`).json()

  t.deepEqual(response.headers, {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate, br',
    'client-ip': '127.0.0.1',
    connection: 'close',
    host: `${host}:${port}`,
    'user-agent': 'got (https://github.com/sindresorhus/got)',
    'x-forwarded-for': '::ffff:127.0.0.1',
  })
  t.is(response.httpMethod, 'GET')
  t.is(response.isBase64Encoded, false)
  t.is(response.path, '/.netlify/functions/echo')
  t.deepEqual(response.queryStringParameters, { category: 'a, b' })
  t.deepEqual(response.multiValueQueryStringParameters, { category: ['a', 'b'] })
})
