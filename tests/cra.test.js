const path = require('path')
const test = require('ava')
const waitPort = require('wait-port')
const fetch = require('node-fetch')
const { startDevServer } = require('./utils/dev-server')
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
  const response = await fetch(`${url}/`).then((r) => r.text())

  t.regex(response, /Web site created using create-react-app/)
})

test('static/js/bundle.js', async (t) => {
  const { url } = t.context.server
  const response = await fetch(`${url}/static/js/bundle.js`)
  const body = await response.text()

  t.is(response.status, 200)
  t.true(body.length > BUNDLE_MIN_LENGTH)
  t.truthy(response.headers.get('content-type').startsWith('application/javascript'))
  t.regex(body, /webpackBootstrap/)
})

const BUNDLE_MIN_LENGTH = 1e2

test('static file under public/', async (t) => {
  const { url } = t.context.server
  const response = await fetch(`${url}/test.html`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/html'))
  t.true(body.includes('<h1>Test content</h1>'))
})

test('redirect test', async (t) => {
  const { url } = t.context.server
  const response = await fetch(`${url}/something`, { redirect: 'manual' })

  t.is(response.status, 301)
  t.is(response.headers.get('location'), `${url}/otherthing.html`)
  t.is(await response.text(), 'Redirecting to /otherthing.html')
})

test('normal rewrite', async (t) => {
  const { url } = t.context.server
  const response = await fetch(`${url}/doesnt-exist`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/html'))
  t.regex(body, /Web site created using create-react-app/)
})

test('force rewrite', async (t) => {
  const { url } = t.context.server
  const response = await fetch(`${url}/force.html`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/html'))
  t.true(body.includes('<h1>Test content</h1>'))
})

test('robots.txt', async (t) => {
  const { url } = t.context.server
  const response = await fetch(`${url}/robots.txt`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/plain'))
  // First line of the file
  t.regex(body, /# https:\/\/www.robotstxt.org\/robotstxt.html/)
})

test('functions rewrite echo without body', async (t) => {
  const { url, host, port } = t.context.server
  const response = await fetch(`${url}/api/echo?ding=dong`).then((r) => r.json())

  t.is(response.body, undefined)
  t.deepEqual(response.headers, {
    'accept': '*/*',
    'accept-encoding': 'gzip,deflate',
    'client-ip': '127.0.0.1',
    'connection': 'close',
    'host': `${host}:${port}`,
    'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
    'x-forwarded-for': '::ffff:127.0.0.1',
  })
  t.is(response.httpMethod, 'GET')
  t.is(response.isBase64Encoded, false)
  t.is(response.path, '/api/echo')
  t.deepEqual(response.queryStringParameters, { ding: 'dong' })
})

test('functions rewrite echo with body', async (t) => {
  const { url, host, port } = t.context.server
  const response = await fetch(`${url}/api/echo?ding=dong`, {
    method: 'POST',
    body: 'some=thing',
  }).then((r) => r.json())

  t.is(response.body, 'some=thing')
  t.deepEqual(response.headers, {
    'accept': '*/*',
    'accept-encoding': 'gzip,deflate',
    'client-ip': '127.0.0.1',
    'connection': 'close',
    'host': `${host}:${port}`,
    'content-type': 'text/plain;charset=UTF-8',
    'content-length': '10',
    'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
    'x-forwarded-for': '::ffff:127.0.0.1',
  })
  t.is(response.httpMethod, 'POST')
  t.is(response.isBase64Encoded, false)
  t.is(response.path, '/api/echo')
  t.deepEqual(response.queryStringParameters, { ding: 'dong' })
})

test('functions echo with multiple query params', async (t) => {
  const { url, host, port } = t.context.server
  const response = await fetch(`${url}/.netlify/functions/echo?category=a&category=b`).then((r) => r.json())

  t.deepEqual(response.headers, {
    'accept': '*/*',
    'accept-encoding': 'gzip,deflate',
    'client-ip': '127.0.0.1',
    'connection': 'close',
    'host': `${host}:${port}`,
    'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
    'x-forwarded-for': '::ffff:127.0.0.1',
  })
  t.is(response.httpMethod, 'GET')
  t.is(response.isBase64Encoded, false)
  t.is(response.path, '/.netlify/functions/echo')
  t.deepEqual(response.queryStringParameters, { category: 'a, b' })
  t.deepEqual(response.multiValueQueryStringParameters, { category: ['a', 'b'] })
})
