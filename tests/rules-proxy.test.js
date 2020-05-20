const path = require('path')
const http = require('http')

const fetch = require('node-fetch')
const test = require('ava')
const getPort = require('get-port')

const sitePath = path.join(__dirname, 'dummy-site')
const { createRewriter } = require('../src/utils/rules-proxy')

test.before(async t => {
  const rewriter = await createRewriter({
    distDir: sitePath,
    projectDir: sitePath,
    configPath: path.join(sitePath, 'netlify.toml'),
  })
  const port = await getPort({ port: 8888 })
  const server = http.createServer(function(req, res) {
    rewriter(req, res, match => res.end(JSON.stringify(match)))
  })

  t.context.port = port
  t.context.server = server

  return server.listen(port)
})

test('/something rule', async t => {
  const response = await fetch(`http://localhost:${t.context.port}/something`).then(r => r.json())

  t.is(response.from, '/something')
  t.is(response.to, '/ping')
  t.is(response.force, false)
  t.is(response.host, '')
  t.is(response.negative, false)
  t.is(response.scheme, '')
  t.is(response.status, 200)
})

test.after(t => {
  t.context.server.close()
})
