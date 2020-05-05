const fs = require('fs')
const path = require('path')
const util = require('util')
const { spawn } = require('child_process')
const test = require('ava')
const fetch = require('node-fetch')
const mkdirp = require('mkdirp')
const cliPath = require('./utils/cliPath')
const { randomPort } = require('./utils/')
const sitePath = path.join(__dirname, 'site-cra')

const fileWrite = util.promisify(fs.writeFile)

let ps, host, port

test.before(async t => {
  console.log('Running Netlify Dev server in Create React App project')
  ps = await spawn(cliPath, ['dev', '-p', randomPort()], {
      cwd: sitePath,
      env: { ...process.env, DUMMY_VAR: 'true', SKIP_PREFLIGHT_CHECK: 'true' },
      stdio: ['inherit', 'pipe', 'inherit'],
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
  })
})

test('netlify dev cra: homepage', async t => {
  const response = await fetch(`http://${host}:${port}/`).then(r => r.text())

  t.regex(response, /Web site created using create-react-app/)
})

test('netlify dev cra: static/js/bundle.js', async t => {
  const response = await fetch(`http://${host}:${port}/static/js/bundle.js`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(body.length > 100)
  t.truthy(response.headers.get('content-type').startsWith('application/javascript'))
  t.regex(body, /webpackBootstrap/)
})

test('netlify dev cra: static file under build/', async t => {
  const publicPath = path.join(sitePath, 'public')
  await mkdirp(publicPath)

  const expectedContent = '<html><h1>Test content'

  await fileWrite(path.join(publicPath, 'test.html'), expectedContent)

  const response = await fetch(`http://${host}:${port}/test.html`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/html'))
  t.is(body, expectedContent)
})

test('netlify dev cra: force rewrite', async t => {
  const publicPath = path.join(sitePath, 'public')
  await mkdirp(publicPath)

  await fileWrite(path.join(publicPath, 'force.html'), '<html><h1>This should never show')

  const response = await fetch(`http://${host}:${port}/force.html`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/html'))
  t.regex(body, /Web site created using create-react-app/)
})

test('netlify dev cra: robots.txt', async t => {
  const response = await fetch(`http://${host}:${port}/robots.txt`)
  const body = await response.text()

  t.is(response.status, 200)
  t.truthy(response.headers.get('content-type').startsWith('text/plain'))
  // First line of the file
  t.regex(body, /# https:\/\/www.robotstxt.org\/robotstxt.html/)
})

test.after.always('cleanup', async t => {
  if (ps && ps.pid) ps.kill(process.platform !== 'win32' ? 'SIGHUP' : undefined)
})
