const path = require('path')
const util = require('util')
const { spawn, exec } = require('child_process')
const test = require('ava')
const fetch = require('node-fetch')
const FormData = require('form-data')
const cliPath = require('./utils/cliPath')
const { randomPort } = require('./utils/')
const sitePath = path.join(__dirname, 'dummy-site')

const execProcess = util.promisify(exec)

let ps
const port = randomPort()
const host = 'localhost:' + port

test.before(async t => {
  console.log('Running Netlify Dev server')
  ps = await spawn(cliPath, ['dev', '-p', port], {
    cwd: sitePath,
    env: { ...process.env, DUMMY_VAR: 'true' },
    stdio: 'pipe',
    shell: true,
  })
  return new Promise((resolve, reject) => {
    ps.stdout.on('data', data => {
      data = data.toString()
      if (data.includes('Server now ready on')) {
        resolve()
      }
    })
  })
})

test('/', async t => {
  const response = await fetch(`http://${host}/`).then(r => r.text())

  t.regex(response, /⊂◉‿◉つ/)
})

test('functions timeout', async t => {
  const response = await fetch(`http://${host}/.netlify/functions/timeout`).then(r => r.text())

  t.is(response, '"ping"')
})

test('functions:invoke', async t => {
  const { stdout } = await execProcess(
    [cliPath, 'functions:invoke', 'timeout', '--identity', '--port=' + port].join(' '),
    {
      cwd: sitePath,
      env: process.env,
    }
  )

  t.is(stdout, '"ping"\n')
})

test('functions env file', async t => {
  const response = await fetch(`http://${host}/.netlify/functions/env`).then(r => r.text())

  t.is(response, 'true')
})

test('functions rewrite echo without body', async t => {
  const response = await fetch(`http://${host}/api/echo?ding=dong`).then(r => r.json())

  t.is(response.body, undefined)
  t.deepEqual(response.headers, {
    'accept': '*/*',
    'accept-encoding': 'gzip,deflate',
    'client-ip': '127.0.0.1',
    'connection': 'close',
    'host': `${host}`,
    'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
    'x-forwarded-for': '::ffff:127.0.0.1',
  })
  t.is(response.httpMethod, 'GET')
  t.is(response.isBase64Encoded, false)
  t.is(response.path, '/api/echo')
  t.deepEqual(response.queryStringParameters, { ding: 'dong' })
})

test('functions rewrite echo with body', async t => {
  const response = await fetch(`http://${host}/api/echo?ding=dong`, {
    method: 'POST',
    body: 'some=thing',
  }).then(r => r.json())

  t.is(response.body, 'some=thing')
  t.deepEqual(response.headers, {
    'accept': '*/*',
    'accept-encoding': 'gzip,deflate',
    'client-ip': '127.0.0.1',
    'connection': 'close',
    'host': `${host}`,
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

test('functions rewrite echo with Form body', async t => {
  const form = new FormData()
  form.append('some', 'thing')
  const response = await fetch(`http://${host}/api/echo?ding=dong`, {
    method: 'POST',
    body: form.getBuffer(),
    headers: form.getHeaders(),
  }).then(r => r.json())

  const formBoundary = form.getBoundary()

  t.deepEqual(response.headers, {
    'accept': '*/*',
    'accept-encoding': 'gzip,deflate',
    'client-ip': '127.0.0.1',
    'connection': 'close',
    'host': `${host}`,
    'content-length': form.getLengthSync().toString(),
    'content-type': `multipart/form-data; boundary=${formBoundary}`,
    'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
    'x-forwarded-for': '::ffff:127.0.0.1',
  })
  t.is(response.httpMethod, 'POST')
  t.is(response.isBase64Encoded, false)
  t.is(response.path, '/api/echo')
  t.deepEqual(response.queryStringParameters, { ding: 'dong' })
  t.regex(response.body, new RegExp(formBoundary))
})

test('functions env file overriding prod var', async t => {
  const response = await fetch(`http://${host}/.netlify/functions/override-process-env`).then(r => r.text())

  t.is(response, 'false')
})

test('api rewrite', async t => {
  const response = await fetch(`http://${host}/api/timeout`).then(r => r.text())

  t.is(response, '"ping"')
})

test('shadowing: foo', async t => {
  const response = await fetch(`http://${host}/foo`).then(r => r.text())

  t.is(response, '<html><h1>foo')
})

test('shadowing: foo.html', async t => {
  const response = await fetch(`http://${host}/foo.html`).then(r => r.text())

  t.is(response, '<html><h1>foo')
})

test('shadowing: not-foo', async t => {
  const response = await fetch(`http://${host}/not-foo`).then(r => r.text())

  t.is(response, '<html><h1>foo')
})

test('shadowing: not-foo/', async t => {
  const response = await fetch(`http://${host}/not-foo/`).then(r => r.text())

  t.is(response, '<html><h1>foo')
})

test('shadowing: not-foo/index.html', async t => {
  const response = await fetch(`http://${host}/not-foo/index.html`).then(r => r.text())

  t.is(response, '<html><h1>not-foo')
})

test('404.html', async t => {
  const response = await fetch(`http://${host}/non-existent`).then(r => r.text())

  t.regex(response, /<h1>404 - Page not found<\/h1>/)
})

test('test 404 shadow - no static file', async t => {
  const response = await fetch(`http://${host}/test-404a`)

  t.is(response.status, 404)
  t.is(await response.text(), '<html><h1>foo')
})

test('test 404 shadow - with static file', async t => {
  const response = await fetch(`http://${host}/test-404b`)

  t.is(response.status, 200)
  t.is(await response.text(), '<html><h1>This page actually exists')
})

test('test 404 shadow - with static file but force', async t => {
  const response = await fetch(`http://${host}/test-404c`)

  t.is(response.status, 404)
  t.is(await response.text(), '<html><h1>foo')
})

test.after.always('cleanup', async t => {
  if (ps && ps.pid) ps.kill(process.platform !== 'win32' ? 'SIGHUP' : undefined)
})
