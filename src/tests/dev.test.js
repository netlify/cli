const path = require('path')
const { spawn } = require('child_process')
const test = require('ava')
const fetch = require('node-fetch')
const cliPath = require('./utils/cliPath')
const sitePath = path.join(__dirname, 'dummy-site')

let ps, host, port

test.before(async t => {
  console.log('Running Netlify Dev server')
  ps = await spawn(
    // Remove quotes from path
    cliPath.slice(1, cliPath.length - 1),
    ['dev'],
    {
      cwd: sitePath,
      env: { ...process.env, DUMMY_VAR: 'true' },
      detached: true,
      shell: true,
    }
  )
  let res, rej
  const p = new Promise((resolve, reject) => {
    res = resolve
    rej = reject
  })
  ps.stdout.on('data', (data) => {
    data = data.toString()
    if (data.includes('Server now ready on')) {
      const matches = data.match(/http:\/\/(.+):(\d+)/)

      // If we didn't get the host and port
      if (matches.length < 3) return rej('Unexpected output received from Dev server')

      port = matches.pop()
      host = matches.pop()
      res()
    }
  })

  // Wait 30 seconds for the Dev server to start, otherwise timeout
  return Promise.race([
    p,
    new Promise((resolve, reject) => setTimeout(() => reject('Timedout waiting for Dev server to start'), 30000))]
  )
})

test('netlify dev functions timeout', async t => {
  const response = await fetch(`http://${host}:${port}/.netlify/functions/timeout`).then(r => r.text())

  t.is(response, '"ping"')
})

test('netlify dev env file', async t => {
  const response = await fetch(`http://${host}:${port}/.netlify/functions/env`).then(r => r.text())

  t.is(response, 'true')
})


test('netlify dev env file overriding prod var', async t => {
  const response = await fetch(`http://${host}:${port}/.netlify/functions/override-process-env`).then(r => r.text())

  t.is(response, 'false')
})

test('netlify dev: api rewrite', async t => {
  // Wait for the redirect rules to be parsed
  await new Promise((resolve, reject) => setTimeout(resolve, 1000))

  const response = await fetch(`http://${host}:${port}/api/timeout`).then(r => r.text())

  t.is(response, '"ping"')
})

test.after.always('cleanup', async t => {
  if (ps && ps.pid) ps.kill('SIGHUP')
})
