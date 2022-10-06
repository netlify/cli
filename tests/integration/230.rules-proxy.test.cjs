const http = require('http')
const path = require('path')

const test = require('ava')
const getPort = require('get-port')

const { createRewriter, getWatchers } = require('../../src/utils/rules-proxy.cjs')

const got = require('./utils/got.cjs')
const { createSiteBuilder } = require('./utils/site-builder.cjs')

test.before(async (t) => {
  const builder = createSiteBuilder({ siteName: 'site-with-redirects-file' })
  builder.withRedirectsFile({
    redirects: [{ from: '/something ', to: '/ping', status: 200 }],
  })

  await builder.buildAsync()

  const rewriter = await createRewriter({
    distDir: builder.directory,
    projectDir: builder.directory,
    jwtSecret: '',
    jwtRoleClaim: '',
    configPath: path.join(builder.directory, 'netlify.toml'),
  })
  const port = await getPort({ port: PORT })
  const server = http.createServer(async function onRequest(req, res) {
    const match = await rewriter(req)
    res.end(JSON.stringify(match))
  })

  t.context.port = port
  t.context.server = server
  t.context.builder = builder

  await new Promise((resolve) => {
    server.listen(port, 'localhost', resolve)
  })
})

const PORT = 8888

test.after(async (t) => {
  await new Promise((resolve) => {
    t.context.server.on('close', resolve)
    t.context.server.close()
  })
  await Promise.all(getWatchers().map((watcher) => watcher.close()))
  await t.context.builder.cleanupAsync()
})

test('should apply re-write rule based on _redirects file', async (t) => {
  const response = await got(`http://localhost:${t.context.port}/something`).json()

  t.is(response.from, '/something')
  t.is(response.to, '/ping')
  t.is(response.force, false)
  t.is(response.host, '')
  t.is(response.negative, false)
  t.is(response.scheme, '')
  t.is(response.status, 200)
})
