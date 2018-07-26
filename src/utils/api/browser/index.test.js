const test = require('ava')
const http = require('http')
const promisify = require('util.promisify')
const NetlifyAPI = require('./index')
const body = promisify(require('body'))

const createServer = handler => {
  const server = http.createServer(handler)
  server._close = server.close
  server.close = promisify(cb => server._close(cb))
  server._listen = server.listen
  server.listen = promisify((port, cb) => server._listen(port, cb))
  return server
}

const port = 1123

const client = new NetlifyAPI('1234', {
  scheme: 'http',
  host: `localhost:${port}`,
  pathPrefix: '/v1',
  globalParams: { clientId: '1234' }
})

test.serial('can make basic requests', async t => {
  const server = createServer((req, res) => {
    t.is(req.url, '/v1/oauth/tickets?client_id=1234')
    res.end('{"foo": "bar"}')
  })

  await server.listen(port)

  const body = await client.createTicket()
  t.is(body.status, 200)
  t.deepEqual(body, { foo: 'bar' })

  await server.close()
})

test.serial('can make requests with a body', async t => {
  const server = createServer(async (req, res) => {
    t.is(req.url, '/v1/hooks?site_id=Site123')
    t.is(await body(req), '{"some":"bodyParams","another":"one"}')
    res.end('{"foo": "bar"}')
  })

  await server.listen(port)

  const response = await client.createHookBySiteId({
    site_id: 'Site123',
    body: {
      some: 'bodyParams',
      another: 'one'
    }
  })
  t.is(response.status, 200)
  t.deepEqual(response, { foo: 'bar' })

  await server.close()
})

test.serial('basic api exists', async t => {
  t.is(client.basePath, `http://localhost:1123/v1`, 'basePath getter works')
  t.is(client.accessToken, '1234', 'accessToken is set')
  t.deepEqual(
    client.defaultHeaders,
    {
      Authorization: 'Bearer 1234',
      'User-agent': 'netlify-js-client',
      accept: 'application/json'
    },
    'Default headers are set'
  )
  client.accessToken = undefined
  t.falsy(client.accessToken, 'deleting access token works fine')
  client.accessToken = 5678
  t.is(client.accessToken, '5678', 'accessToken is set')
  t.is(client.defaultHeaders.Authorization, 'Bearer 5678', 'Bearer token is updated correctly')
})
