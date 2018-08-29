const test = require('ava')
const http = require('http')
const promisify = require('util.promisify')
const NetlifyAPI = require('./index')
const body = promisify(require('body'))
const fromString = require('from2-string')
const Headers = require('node-fetch').Headers

const createServer = handler => {
  const s = http.createServer(handler)
  s._close = s.close
  s.close = promisify(cb => s._close(cb))
  s._listen = s.listen
  s.listen = promisify((port, cb) => s._listen(port, cb))
  return s
}

const port = 1123

const client = new NetlifyAPI('1234', {
  scheme: 'http',
  host: `localhost:${port}`,
  pathPrefix: '/v1',
  globalParams: { clientId: '1234' }
})

test.serial('can make basic requests', async t => {
  let server
  try {
    server = createServer((req, res) => {
      t.is(req.url, '/v1/oauth/tickets?client_id=1234')
      res.end('{"foo": "bar"}')
    })

    await server.listen(port)

    const body = await client.createTicket()
    t.is(body.status, 200)
    t.deepEqual(body, { foo: 'bar' })
  } catch (e) {
    t.fail(e)
  }
  await server.close()
})

test.serial('can make requests with a body', async t => {
  let server
  try {
    server = createServer(async (req, res) => {
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
  } catch (e) {
    t.fail(e)
  }
  await server.close()
})

test.serial('path parameter assignment', async t => {
  let server
  try {
    server = createServer(async (req, res) => {
      t.is(req.url, '/v1/hooks?site_id=Site123')
      res.end()
    })

    await server.listen(port)

    t.throwsAsync(
      async () => {
        await client.createHookBySiteId(/* missing args */)
      },
      {
        message: 'Missing required param site_id'
      }
    )
    const response = await client.createHookBySiteId({ siteId: 'Site123' })
    t.deepEqual(response, { body: '' }, 'Testing other path branch')
  } catch (e) {
    t.fail(e)
  }
  await server.close()
})

test.serial('handles errors from API', async t => {
  let server
  try {
    server = createServer(async (req, res) => {
      res.statusCode = 404
      res.statusMessage = 'Test not found'
      res.end()
    })

    await server.listen(port)

    const error = await t.throwsAsync(client.createHookBySiteId({ siteId: 'Site123' }))
    t.is(error.status, 404, 'status code is captures on error')
    t.is(error.statusText, 'Test not found', 'status text is captures on error')
    t.truthy(error.response, 'Error has response object')
    t.truthy(error.path, 'Error has response object')
    t.deepEqual(
      error.opts,

      {
        method: 'POST',
        headers: new Headers({
          Authorization: 'Bearer 1234',
          'User-agent': '@netlify/js-client',
          accept: 'application/json'
        })
      },
      'Opts look correct'
    )
  } catch (e) {
    t.fail(e)
  }
  await server.close()
})

test.serial('basic api exists', async t => {
  t.is(client.basePath, `http://localhost:1123/v1`, 'basePath getter works')
  t.is(client.accessToken, '1234', 'accessToken is set')
  t.deepEqual(
    client.defaultHeaders,
    {
      Authorization: 'Bearer 1234',
      'User-agent': '@netlify/js-client',
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

test.serial('binary uploads', async t => {
  let server
  try {
    server = createServer(async (req, res) => {
      t.is(await body(req), 'hello world')
      res.statusCode = 200
      res.statusMessage = 'OK'
      res.end('{"ok": true}')
    })

    await server.listen(port)

    const readStream = fromString('hello world')
    const response = await client.uploadDeployFile({
      body: readStream,
      deployId: '123',
      path: 'normalizedPath'
    })

    t.deepEqual(response, { ok: true })
    t.is(response.status, 200)
  } catch (e) {
    t.fail(e)
  }
  await server.close()
})

test('variadic api', async t => {
  const newClient = new NetlifyAPI({
    scheme: 'http',
    host: `localhost:${port}`,
    pathPrefix: '/v1',
    globalParams: { clientId: '1234' }
  })

  t.falsy(newClient.accessToken, 'can instantiate with just options')
  t.falsy(newClient.defaultHeaders.Authorization, 'headers are falsy when not set')

  newClient.accessToken = '123'

  t.is(newClient.accessToken, '123', 'can set the access token and get it back')
  t.is(newClient.defaultHeaders.Authorization, 'Bearer 123', 'headers are set')
})

test.serial('access token can poll', async t => {
  let server
  try {
    let okayToResponse = false
    setTimeout(() => {
      okayToResponse = true
    }, 100)
    server = createServer(async (req, res) => {
      if (req.url == '/v1/oauth/tickets/ticket-id') {
        if (!okayToResponse) {
          res.end('{}')
        } else {
          res.end(
            JSON.stringify({
              authorized: true,
              id: 'ticket-id'
            })
          )
        }
      } else if (req.url == '/v1/oauth/tickets/ticket-id/exchange') {
        res.end(
          JSON.stringify({
            access_token: 'open-sesame'
          })
        )
      } else {
        res.statusCode = 500
        res.end(JSON.stringify({ path: req.url }))
      }
    })

    await server.listen(port)

    const accessToken = await client.getAccessToken({ id: 'ticket-id' }, { poll: 50, timeout: 5000 })

    t.is(accessToken, 'open-sesame')
  } catch (e) {
    t.fail(e)
  }

  await server.close()
})
