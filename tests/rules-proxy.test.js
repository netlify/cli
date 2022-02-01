const http = require('http')
const path = require('path')

const getPort = require('get-port')

const { createRewriter } = require('../src/utils/rules-proxy')

const got = require('./utils/got')
const { createSiteBuilder } = require('./utils/site-builder')

let port
let server
let builder

beforeAll(async () => {
  builder = createSiteBuilder({ siteName: 'site-with-redirects-file' })
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
  port = await getPort({ port: PORT })
  server = http.createServer(async function onRequest(req, res) {
    const match = await rewriter(req)
    res.end(JSON.stringify(match))
  })

  return server.listen(port)
})

const PORT = 8888

afterAll(async () => {
  await new Promise((resolve) => {
    server.on('close', resolve)
    server.close()
  })
  // TODO: check why this line breaks the rewriter on windows
  // await builder.cleanupAsync()
})

test('should apply re-write rule based on _redirects file', async () => {
  const response = await got(`http://localhost:${port}/something`).json()

  expect(response.from).toBe('/something')
  expect(response.to).toBe('/ping')
  expect(response.force).toBe(false)
  expect(response.host).toBe('')
  expect(response.negative).toBe(false)
  expect(response.scheme).toBe('')
  expect(response.status).toBe(200)
})
