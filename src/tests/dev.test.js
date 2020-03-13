const path = require('path')
const { spawn } = require('child_process')
const test = require('ava')
const http = require('http')
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
      env: Object.assign({}, process.env, { DUMMY_VAR: "true" }),
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

  // Wait 5 seconds for the Dev server to start, otherwise timeout
  return Promise.race([
    p,
    new Promise((resolve, reject) => setTimeout(() => reject('Timedout waiting for Dev server to start'), 10000))]
  )
})

test('netlify dev functions timeout', async t => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: host,
      port: port,
      path: '/.netlify/functions/timeout',
      method: 'GET',
    }, (res) =>
    {
      res.on('data', () => {})
      res.on('end', resolve)
    })
    req.on('error', reject)

    req.end()
  })
})

test('netlify dev env file', async t => {
  let data = ""
  await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: host,
      port: port,
      path: '/.netlify/functions/env',
      method: 'GET',
    }, (res) =>
    {
      res.on('data', (d) => {data += d.toString()})
      res.on('end', resolve)
    })
    req.on('error', reject)

    req.end()
  })

  t.is(data, "true")
})


test('netlify dev env file overriding prod var', async t => {
  let data = ""
  await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: host,
      port: port,
      path: '/.netlify/functions/override-process-env',
      method: 'GET',
    }, (res) =>
    {
      res.on('data', (d) => {data += d.toString()})
      res.on('end', resolve)
    })
    req.on('error', reject)

    req.end()
  })

  t.is(data, "false")
})

test.after('cleanup', async t => {
  if (ps && ps.pid) ps.kill('SIGHUP')
})
