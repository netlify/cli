const path = require('path')
const { spawn, spawnSync } = require('child_process')
const url = require('url')
const test = require('ava')
const fetch = require('node-fetch')
const cliPath = require('./utils/cliPath')
const { randomPort } = require('./utils/')
const sitePath = path.join(__dirname, 'site-cra')

let ps, host, port

test.before(async t => {
  console.log('Installing Create React App project dependencies')
  const { stdout, stderr, status  } = spawnSync('npm', ['ci'], { cwd: sitePath })
  if (status !== 0) {
    const message = `Failed installing Create React App project dependencies from path '${sitePath}'`
    console.error(message)
    console.log('stdout:', stdout.toString())
    console.log('stderr:', stderr.toString())
    throw new Error(message)
  }
  console.log('Running Netlify Dev server in Create React App project')
  ps = await spawn(cliPath, ['dev', '-p', randomPort()], {
      cwd: sitePath,
      env: { ...process.env, DUMMY_VAR: 'true', SKIP_PREFLIGHT_CHECK: 'true' },
      stdio: 'pipe',
      shell: true,
    }
  )
  return new Promise((resolve, reject) => {
    ps.stdout.on('data', (data) => {
      data = data.toString()
      if (data.includes('Server now ready on')) {
        const matches = data.match(/http:\/\/(.+):(\d+)/)

        // If we didn't get the host and port
        if (matches.length < 3) return reject('Unexpected output received from Dev server')

        port = matches.pop()
        host = matches.pop()
        resolve()
      }
    })

    let error = ''
    ps.stderr.on('data' ,(data) => {
      error = error + data.toString()
    })
    ps.on('close', (code) => {
      if (code !== 0) {
        console.error(error)
        reject(error)
      }
    })
  })
})

test('homepage', async t => {
  const response = await fetch(`http://${host}:${port}/`).then(r => r.text())

  t.regex(response, /Web site created using create-react-app/)
})

test('static/js/bundle.js', async t => {
  const response = await fetch(`http://${host}:${port}/static/js/bundle.js`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(body.length > 100)
  t.truthy(response.headers.get('content-type').startsWith('application/javascript'))
  t.regex(body, /webpackBootstrap/)
})

test('static file under public/', async t => {
  const response = await fetch(`http://${host}:${port}/test.html`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/html'))
  t.is(body, '<html><h1>Test content')
})

test('redirect test', async t => {
  const requestURL = new url.URL(`http://${host}:${port}/something`)
  const response = await fetch(requestURL, { redirect: 'manual' })

  const expectedUrl = new url.URL(requestURL.toString())
  expectedUrl.pathname = '/otherthing.html'

  t.is(response.status, 301)
  t.is(response.headers.get('location'), expectedUrl.toString())
  t.is(await response.text(), 'Redirecting to /otherthing.html')
})

test('normal rewrite', async t => {
  const response = await fetch(`http://${host}:${port}/doesnt-exist`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/html'))
  t.regex(body, /Web site created using create-react-app/)
})

test('force rewrite', async t => {
  const response = await fetch(`http://${host}:${port}/force.html`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/html'))
  t.is(body, '<html><h1>Test content')
})

test('robots.txt', async t => {
  const response = await fetch(`http://${host}:${port}/robots.txt`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/plain'))
  // First line of the file
  t.regex(body, /# https:\/\/www.robotstxt.org\/robotstxt.html/)
})


test('functions rewrite echo without body', async t => {
  const response = await fetch(`http://${host}:${port}/api/echo?ding=dong`).then(r => r.json())

  t.is(response.body, undefined)
  t.deepEqual(response.headers, {
    accept: '*/*',
    'accept-encoding': 'gzip,deflate',
    'client-ip': '127.0.0.1',
    connection: 'close',
    host: `${host}:${port}`,
    'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
    'x-forwarded-for': '::ffff:127.0.0.1',
  })
  t.is(response.httpMethod, 'GET')
  t.is(response.isBase64Encoded, false)
  t.is(response.path, '/api/echo')
  t.deepEqual(response.queryStringParameters, { ding: 'dong' })
})

test('functions rewrite echo with body', async t => {
  const response = await fetch(`http://${host}:${port}/api/echo?ding=dong`, {
    method: 'POST',
    body: 'some=thing',
  }).then(r => r.json())

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

test.after.always('cleanup', async t => {
  if (ps && ps.pid) ps.kill(process.platform !== 'win32' ? 'SIGHUP' : undefined)
})
