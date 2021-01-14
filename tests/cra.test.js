const path = require('path')

const test = require('ava')
const fetch = require('node-fetch')
const waitPort = require('wait-port')

const { startDevServer } = require('./utils/dev-server')
const got = require('./utils/got')

const sitePath = path.join(__dirname, 'site-cra')

test.before(async (t) => {
  const server = await startDevServer({
    cwd: sitePath,
    env: { SKIP_PREFLIGHT_CHECK: 'true' },
  })

  // wait for react app dev server to start
  await waitPort({ port: SERVER_PORT, timeout: REACT_APP_START_TIMEOUT, output: 'silent' })
  t.context.server = server
})

const SERVER_PORT = 3000

// 15 seconds
const REACT_APP_START_TIMEOUT = 15e3

test.after(async (t) => {
  const { server } = t.context
  await server.close()
})

test('homepage', async (t) => {
  const { url } = t.context.server
  const response = await got(`${url}/`).text()

  t.true(response.includes('Web site created using create-react-app'))
})

test('static/js/bundle.js', async (t) => {
  const { url } = t.context.server
  const { body, statusCode, headers } = await got(`${url}/static/js/bundle.js`)

  t.is(statusCode, 200)
  t.true(body.length > BUNDLE_MIN_LENGTH)
  t.true(headers['content-type'].startsWith('application/javascript'))
  t.true(body.includes('webpackBootstrap'))
})

const BUNDLE_MIN_LENGTH = 1e2

test('static file under public/', async (t) => {
  const { url } = t.context.server
  const { body, statusCode, headers } = await got(`${url}/test.html`)

  t.is(statusCode, 200)
  t.true(headers['content-type'].startsWith('text/html'))
  t.true(body.includes('<h1>Test content</h1>'))
})

test('redirect test', async (t) => {
  const { url } = t.context.server
  const { body, statusCode, headers } = await got(`${url}/something`, { followRedirect: false })

  t.is(statusCode, 301)
  t.is(headers.location, `/otherthing.html`)
  t.is(body, 'Redirecting to /otherthing.html')
})

test('normal rewrite', async (t) => {
  const { url } = t.context.server
  // TODO: replace with got like the rest of the tests
  // This test passes with fetch and curl, but not with got (returns 404 with got)
  const response = await fetch(`${url}/doesnt-exist`)
  const body = await response.text()

  t.is(response.status, 200)
  t.true(response.headers.get('content-type').startsWith('text/html'))
  t.true(body.includes('Web site created using create-react-app'))
})

test('force rewrite', async (t) => {
  const { url } = t.context.server
  const { body, statusCode, headers } = await got(`${url}/force.html`)

  t.is(statusCode, 200)
  t.true(headers['content-type'].startsWith('text/html'))
  t.true(body.includes('<h1>Test content</h1>'))
})

test('robots.txt', async (t) => {
  const { url } = t.context.server
  const { body, statusCode, headers } = await got(`${url}/robots.txt`)

  t.is(statusCode, 200)
  t.true(headers['content-type'].startsWith('text/plain'))
  t.true(body.startsWith('# https://www.robotstxt.org/robotstxt.html'))
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
