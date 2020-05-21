const path = require('path')
const { spawn, spawnSync } = require('child_process')
const url = require('url')
const test = require('ava')
const fetch = require('node-fetch')
const cliPath = require('./utils/cliPath')
const { randomPort } = require('./utils/')
const sitePath = path.join(__dirname, 'site-cra')

let ps
const port = randomPort()
const host = 'localhost:' + port

test.before(async t => {
  console.log('Installing Create React App project dependencies')
  const { stdout, stderr, status, error } = spawnSync('npm', ['ci', '--prefix', 'tests/site-cra'], { shell: true })
  if (status !== 0) {
    const message = `Failed installing Create React App project dependencies from path '${sitePath}'`
    console.error(message)
    if (error) {
      console.log('error:', error.message)
    }
    if (stdout) {
      console.log('stdout:', stdout.toString())
    }
    if (stderr) {
      console.log('stderr:', stderr.toString())
    }
    throw new Error(message)
  }
  console.log('Running Netlify Dev server in Create React App project')
  ps = await spawn(cliPath, ['dev', '-p', port], {
    cwd: sitePath,
    env: { ...process.env, DUMMY_VAR: 'true', SKIP_PREFLIGHT_CHECK: 'true' },
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

    let error = ''
    ps.stderr.on('data', data => {
      error = error + data.toString()
    })
    ps.on('close', code => {
      if (code !== 0) {
        console.error(error)
        reject(error)
      }
    })
  })
})

test('homepage', async t => {
  const response = await fetch(`http://${host}/`).then(r => r.text())

  t.regex(response, /Web site created using create-react-app/)
})

test('static/js/bundle.js', async t => {
  const response = await fetch(`http://${host}/static/js/bundle.js`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(body.length > 100)
  t.truthy(response.headers.get('content-type').startsWith('application/javascript'))
  t.regex(body, /webpackBootstrap/)
})

test('static file under public/', async t => {
  const response = await fetch(`http://${host}/test.html`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/html'))
  t.is(body, '<html><h1>Test content')
})

test('redirect test', async t => {
  const requestURL = new url.URL(`http://${host}/something`)
  const response = await fetch(requestURL, { redirect: 'manual' })

  const expectedUrl = new url.URL(requestURL.toString())
  expectedUrl.pathname = '/otherthing.html'

  t.is(response.status, 301)
  t.is(response.headers.get('location'), expectedUrl.toString())
  t.is(await response.text(), 'Redirecting to /otherthing.html')
})

test('normal rewrite', async t => {
  const response = await fetch(`http://${host}/doesnt-exist`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/html'))
  t.regex(body, /Web site created using create-react-app/)
})

test('force rewrite', async t => {
  const response = await fetch(`http://${host}/force.html`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/html'))
  t.is(body, '<html><h1>Test content')
})

test('robots.txt', async t => {
  const response = await fetch(`http://${host}/robots.txt`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/plain'))
  // First line of the file
  t.regex(body, /# https:\/\/www.robotstxt.org\/robotstxt.html/)
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

test.after.always('cleanup', async t => {
  if (ps && ps.pid) ps.kill(process.platform !== 'win32' ? 'SIGHUP' : undefined)
})
