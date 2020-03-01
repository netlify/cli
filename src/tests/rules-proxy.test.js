const path = require('path')
const http = require('http')

const test = require('ava')
const getPort = require('get-port')

const sitePath = path.join(__dirname, 'dummy-site')
const createRewriter = require('../utils/rules-proxy')

test.before(async t => {
  const rewriter = createRewriter({
    publicFolder: sitePath,
    configPath: path.join(sitePath, 'netlify.toml')
  })
  const port = await getPort({ port: 8888 })
  const server = http.createServer(function(req, res) {
    rewriter(req, res, match => res.end(JSON.stringify(match)))
  })

  t.context.port = port
  t.context.server = server

  return new Promise(resolve => server.listen(port, () => setTimeout(resolve, 200)))
})

test('homepage rule', async t => {
  const options = {
    hostname: 'localhost',
    port: t.context.port,
    path: '/',
    method: 'GET'
  }

  let data = ''
  const req = http.request(options, (res) => res.on('data', (d) => data += d.toString()))

  req.on('error', error => t.log('error', error))
  req.end()

  return new Promise((resolve, reject) => req.on('close', () => {
    t.is(data.length, 0)
    resolve()
  }))
})

test('/something rule', async t => {
  const options = {
    hostname: 'localhost',
    port: t.context.port,
    path: '/something',
    method: 'GET'
  }

  let data = ''
  const req = http.request(options, (res) => res.on('data', (d) => data += d.toString()))

  req.on('error', error => t.log('error', error))
  req.end()

  return new Promise((resolve, reject) => req.on('close', () => {
    data = JSON.parse(data)
    t.is(data.from, '/something')
    t.is(data.to, '/ping')
    t.is(data.force, false)
    t.is(data.host, '')
    t.is(data.negative, false)
    t.is(data.scheme, '')
    t.is(data.status, 200)
    resolve()
  }))
})

test.after(t => {
  t.context.server.close()
})
