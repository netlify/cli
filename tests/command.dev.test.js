const test = require('ava')
const path = require('path')
const { startDevServer } = require('./utils')
const fetch = require('node-fetch')
const FormData = require('form-data')
const { withSiteBuilder } = require('./utils/siteBuilder')

test('should return index file when / is accessed', async t => {
  await withSiteBuilder('site-with-index-file', async builder => {
    builder.withContentFile({
      path: 'index.html',
      content: '<h1>⊂◉‿◉つ</h1>',
    })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(server.url).then(r => r.text())
    t.is(response, '<h1>⊂◉‿◉つ</h1>')

    server.close()
  })
})

test('should return response from a function with setTimeout', async t => {
  await withSiteBuilder('site-with-set-timeout-function', async builder => {
    builder.withNetlifyToml({ config: { build: { functions: 'functions' } } }).withFunction({
      path: 'timeout.js',
      handler: async (event, context) => {
        console.log('ding')
        // Wait for 4 seconds
        await new Promise((resolve, reject) => setTimeout(resolve, 4000))
        return {
          statusCode: 200,
          body: 'ping',
        }
      },
    })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/.netlify/functions/timeout`).then(r => r.text())
    t.is(response, 'ping')

    server.close()
  })
})

test('should serve function from a subdirectory', async t => {
  await withSiteBuilder('site-with-from-subdirectory', async builder => {
    builder.withNetlifyToml({ config: { build: { functions: 'functions' } } }).withFunction({
      path: path.join('echo', 'echo.js'),
      handler: async (event, context) => {
        return {
          statusCode: 200,
          body: 'ping',
        }
      },
    })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/.netlify/functions/echo`).then(r => r.text())
    t.is(response, 'ping')

    server.close()
  })
})

test('should pass .env.development vars to function', async t => {
  await withSiteBuilder('site-with-env-development', async builder => {
    builder
      .withNetlifyToml({ config: { build: { functions: 'functions' } } })
      .withEnvFile({ path: '.env.development', env: { TEST: 'FROM_DEV_FILE' } })
      .withFunction({
        path: 'env.js',
        handler: async (event, context) => {
          return {
            statusCode: 200,
            body: `${process.env.TEST}`,
          }
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/.netlify/functions/env`).then(r => r.text())
    t.is(response, 'FROM_DEV_FILE')

    server.close()
  })
})

test('should pass process env vars to function', async t => {
  await withSiteBuilder('site-with-process-env', async builder => {
    builder.withNetlifyToml({ config: { build: { functions: 'functions' } } }).withFunction({
      path: 'env.js',
      handler: async (event, context) => {
        return {
          statusCode: 200,
          body: `${process.env.TEST}`,
        }
      },
    })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' } })

    const response = await fetch(`${server.url}/.netlify/functions/env`).then(r => r.text())
    t.is(response, 'FROM_PROCESS_ENV')

    server.close()
  })
})

test('should override process env vars with ones in .env.development', async t => {
  await withSiteBuilder('site-with-override', async builder => {
    builder
      .withNetlifyToml({ config: { build: { functions: 'functions' } } })
      .withEnvFile({ path: '.env.development', env: { TEST: 'FROM_DEV_FILE' } })
      .withFunction({
        path: 'env.js',
        handler: async (event, context) => {
          return {
            statusCode: 200,
            body: `${process.env.TEST}`,
          }
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' } })

    const response = await fetch(`${server.url}/.netlify/functions/env`).then(r => r.text())
    t.is(response, 'FROM_DEV_FILE')

    server.close()
  })
})

test('should redirect using a wildcard when set in netlify.toml', async t => {
  await withSiteBuilder('site-with-redirect-function', async builder => {
    builder
      .withNetlifyToml({
        config: {
          build: { functions: 'functions' },
          redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
        },
      })
      .withFunction({
        path: 'ping.js',
        handler: async (event, context) => {
          return {
            statusCode: 200,
            body: 'ping',
          }
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/api/ping`).then(r => r.text())

    t.is(response, 'ping')

    server.close()
  })
})

test('should pass undefined body to functions event for GET requests when redirecting', async t => {
  await withSiteBuilder('site-with-get-echo-function', async builder => {
    builder
      .withNetlifyToml({
        config: {
          build: { functions: 'functions' },
          redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
        },
      })
      .withFunction({
        path: 'echo.js',
        handler: async (event, context) => {
          return {
            statusCode: 200,
            body: JSON.stringify(event),
          }
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/api/echo?ding=dong`).then(r => r.json())
    t.is(response.body, undefined)
    t.deepEqual(response.headers, {
      'accept': '*/*',
      'accept-encoding': 'gzip,deflate',
      'client-ip': '127.0.0.1',
      'connection': 'close',
      'host': `${server.host}:${server.port}`,
      'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
      'x-forwarded-for': '::ffff:127.0.0.1',
    })
    t.is(response.httpMethod, 'GET')
    t.is(response.isBase64Encoded, false)
    t.is(response.path, '/api/echo')
    t.deepEqual(response.queryStringParameters, { ding: 'dong' })

    server.close()
  })
})

test('should pass body to functions event for POST requests when redirecting', async t => {
  await withSiteBuilder('site-with-post-echo-function', async builder => {
    builder
      .withNetlifyToml({
        config: {
          build: { functions: 'functions' },
          redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
        },
      })
      .withFunction({
        path: 'echo.js',
        handler: async (event, context) => {
          return {
            statusCode: 200,
            body: JSON.stringify(event),
          }
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/api/echo?ding=dong`, {
      method: 'POST',
      body: 'some=thing',
    }).then(r => r.json())

    t.is(response.body, 'some=thing')
    t.deepEqual(response.headers, {
      'accept': '*/*',
      'accept-encoding': 'gzip,deflate',
      'client-ip': '127.0.0.1',
      'connection': 'close',
      'host': `${server.host}:${server.port}`,
      'content-type': 'text/plain;charset=UTF-8',
      'content-length': '10',
      'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
      'x-forwarded-for': '::ffff:127.0.0.1',
    })
    t.is(response.httpMethod, 'POST')
    t.is(response.isBase64Encoded, false)
    t.is(response.path, '/api/echo')
    t.deepEqual(response.queryStringParameters, { ding: 'dong' })

    server.close()
  })
})

test('should return an empty body for a function with no body when redirecting', async t => {
  await withSiteBuilder('site-with-no-body-function', async builder => {
    builder
      .withNetlifyToml({
        config: {
          build: { functions: 'functions' },
          redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
        },
      })
      .withFunction({
        path: 'echo.js',
        handler: async (event, context) => {
          return {
            statusCode: 200,
          }
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/api/echo?ding=dong`, {
      method: 'POST',
      body: 'some=thing',
    })

    t.is(await response.text(), '')
    t.is(response.status, 200)

    server.close()
  })
})

test('should handle multipart form data when redirecting', async t => {
  await withSiteBuilder('site-with-multi-part-function', async builder => {
    builder
      .withNetlifyToml({
        config: {
          build: { functions: 'functions' },
          redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
        },
      })
      .withFunction({
        path: 'echo.js',
        handler: async (event, context) => {
          return {
            statusCode: 200,
            body: JSON.stringify(event),
          }
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const form = new FormData()
    form.append('some', 'thing')

    const response = await fetch(`${server.url}/api/echo?ding=dong`, {
      method: 'POST',
      body: form.getBuffer(),
      headers: form.getHeaders(),
    }).then(r => r.json())

    const formBoundary = form.getBoundary()

    t.deepEqual(response.headers, {
      'accept': '*/*',
      'accept-encoding': 'gzip,deflate',
      'client-ip': '127.0.0.1',
      'connection': 'close',
      'host': `${server.host}:${server.port}`,
      'content-length': form.getLengthSync().toString(),
      'content-type': `multipart/form-data; boundary=${formBoundary}`,
      'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
      'x-forwarded-for': '::ffff:127.0.0.1',
    })
    t.is(response.httpMethod, 'POST')
    t.is(response.isBase64Encoded, false)
    t.is(response.path, '/api/echo')
    t.deepEqual(response.queryStringParameters, { ding: 'dong' })
    t.is(response.body, form.getBuffer().toString())

    server.close()
  })
})

test('should return 404 when redirecting to a non existing function', async t => {
  await withSiteBuilder('site-with-multi-part-function', async builder => {
    builder.withNetlifyToml({
      config: {
        build: { functions: 'functions' },
        redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
      },
    })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const form = new FormData()
    form.append('some', 'thing')

    const response = await fetch(`${server.url}/api/none`, {
      method: 'POST',
      body: 'nothing',
    })

    t.is(response.status, 404)

    server.close()
  })
})

test('should parse function query parameters using simple parsing', async t => {
  await withSiteBuilder('site-with-multi-part-function', async builder => {
    builder
      .withNetlifyToml({
        config: {
          build: { functions: 'functions' },
        },
      })
      .withFunction({
        path: 'echo.js',
        handler: async (event, context) => {
          return {
            statusCode: 200,
            body: JSON.stringify(event),
          }
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response1 = await fetch(`${server.url}/.netlify/functions/echo?category[SOMETHING][]=something`).then(r =>
      r.json()
    )
    const response2 = await fetch(`${server.url}/.netlify/functions/echo?category=one&category=two`).then(r => r.json())

    t.deepEqual(response1.queryStringParameters, { 'category[SOMETHING][]': 'something' })
    t.deepEqual(response2.queryStringParameters, { category: 'one, two' })

    server.close()
  })
})

test('should handle form submission', async t => {
  await withSiteBuilder('site-with-form', async builder => {
    builder
      .withContentFile({
        path: 'index.html',
        content: '<h1>⊂◉‿◉つ</h1>',
      })
      .withNetlifyToml({
        config: {
          build: { functions: 'functions' },
        },
      })
      .withFunction({
        path: 'submission-created.js',
        handler: async (event, context) => {
          return {
            statusCode: 200,
            body: JSON.stringify(event),
          }
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const form = new FormData()
    form.append('some', 'thing')
    const response = await fetch(`${server.url}/?ding=dong`, {
      method: 'POST',
      body: form.getBuffer(),
      headers: form.getHeaders(),
    }).then(r => r.json())

    const body = JSON.parse(response.body)

    t.deepEqual(response.headers, {
      'accept': '*/*',
      'accept-encoding': 'gzip,deflate',
      'client-ip': '127.0.0.1',
      'connection': 'close',
      'host': `${server.host}:${server.port}`,
      'content-length': '285',
      'content-type': 'application/json',
      'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
      'x-forwarded-for': '::ffff:127.0.0.1',
    })
    t.is(response.httpMethod, 'POST')
    t.is(response.isBase64Encoded, false)
    t.is(response.path, '/')
    t.deepEqual(response.queryStringParameters, { ding: 'dong' })
    t.deepEqual(body, {
      payload: {
        created_at: body.payload.created_at,
        data: {
          ip: '::ffff:127.0.0.1',
          some: 'thing',
          user_agent: 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
        },
        human_fields: {
          Some: 'thing',
        },
        ordered_human_fields: [
          {
            name: 'some',
            title: 'Some',
            value: 'thing',
          },
        ],
      },
      site: {},
    })

    server.close()
  })
})

test('should not handle form submission when content type is `text/plain`', async t => {
  await withSiteBuilder('site-with-form-text-plain', async builder => {
    builder
      .withContentFile({
        path: 'index.html',
        content: '<h1>⊂◉‿◉つ</h1>',
      })
      .withNetlifyToml({
        config: {
          build: { functions: 'functions' },
        },
      })
      .withFunction({
        path: 'submission-created.js',
        handler: async (event, context) => {
          return {
            statusCode: 200,
            body: JSON.stringify(event),
          }
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/?ding=dong`, {
      method: 'POST',
      body: 'Something',
      headers: {
        'content-type': 'text/plain',
      },
    }).then(r => r.text())

    t.is(response, 'Method Not Allowed')

    server.close()
  })
})

test('should return existing local file even when redirect matches when force=false', async t => {
  await withSiteBuilder('site-with-shadowing-force-false', async builder => {
    builder
      .withContentFile({
        path: 'foo.html',
        content: '<html><h1>foo',
      })
      .withContentFile({
        path: path.join('not-foo', 'index.html'),
        content: '<html><h1>not-foo',
      })
      .withNetlifyToml({
        config: {
          redirects: [{ from: '/foo', to: '/not-foo', status: 200, force: false }],
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/foo?ping=pong`).then(r => r.text())

    t.is(response, '<html><h1>foo')

    server.close()
  })
})

test('should ignore existing local file when redirect matches and force=true', async t => {
  await withSiteBuilder('site-with-shadowing-force-true', async builder => {
    builder
      .withContentFile({
        path: 'foo.html',
        content: '<html><h1>foo',
      })
      .withContentFile({
        path: path.join('not-foo', 'index.html'),
        content: '<html><h1>not-foo',
      })
      .withNetlifyToml({
        config: {
          redirects: [{ from: '/foo', to: '/not-foo', status: 200, force: true }],
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/foo`).then(r => r.text())

    t.is(response, '<html><h1>not-foo')

    server.close()
  })
})

test('should use existing file when rule contains file extension and force=false', async t => {
  await withSiteBuilder('site-with-shadowing-file-extension-force-false', async builder => {
    builder
      .withContentFile({
        path: 'foo.html',
        content: '<html><h1>foo',
      })
      .withContentFile({
        path: path.join('not-foo', 'index.html'),
        content: '<html><h1>not-foo',
      })
      .withNetlifyToml({
        config: {
          redirects: [{ from: '/foo.html', to: '/not-foo', status: 200, force: false }],
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/foo.html`).then(r => r.text())

    t.is(response, '<html><h1>foo')

    server.close()
  })
})

test('should redirect when rule contains file extension and force=true', async t => {
  await withSiteBuilder('site-with-shadowing-file-extension-force-true', async builder => {
    builder
      .withContentFile({
        path: 'foo.html',
        content: '<html><h1>foo',
      })
      .withContentFile({
        path: path.join('not-foo', 'index.html'),
        content: '<html><h1>not-foo',
      })
      .withNetlifyToml({
        config: {
          redirects: [{ from: '/foo.html', to: '/not-foo', status: 200, force: true }],
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/foo.html`).then(r => r.text())

    t.is(response, '<html><h1>not-foo')

    server.close()
  })
})

test('should redirect from sub directory to root directory', async t => {
  await withSiteBuilder('site-with-shadowing-sub-to-root', async builder => {
    builder
      .withContentFile({
        path: 'foo.html',
        content: '<html><h1>foo',
      })
      .withContentFile({
        path: path.join('not-foo', 'index.html'),
        content: '<html><h1>not-foo',
      })
      .withNetlifyToml({
        config: {
          redirects: [{ from: '/not-foo', to: '/foo', status: 200, force: true }],
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response1 = await fetch(`${server.url}/not-foo`).then(r => r.text())
    const response2 = await fetch(`${server.url}/not-foo/`).then(r => r.text())

    // TODO: check why this doesn't redirect
    const response3 = await fetch(`${server.url}/not-foo/index.html`).then(r => r.text())

    t.is(response1, '<html><h1>foo')
    t.is(response2, '<html><h1>foo')
    t.is(response3, '<html><h1>not-foo')

    server.close()
  })
})

test('should return 404.html if exists for non existing routes', async t => {
  await withSiteBuilder('site-with-shadowing-404', async builder => {
    builder.withContentFile({
      path: '404.html',
      content: '<h1>404 - Page not found</h1>',
    })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/non-existent`).then(r => r.text())
    t.is(response, '<h1>404 - Page not found</h1>')

    server.close()
  })
})

test('should return 404 for redirect', async t => {
  await withSiteBuilder('site-with-shadowing-404-redirect', async builder => {
    builder
      .withContentFile({
        path: 'foo.html',
        content: '<html><h1>foo',
      })
      .withNetlifyToml({
        config: {
          redirects: [{ from: '/test-404', to: '/foo', status: 404 }],
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/test-404`)

    t.is(response.status, 404)
    t.is(await response.text(), '<html><h1>foo')

    server.close()
  })
})

test('should ignore 404 redirect for existing file', async t => {
  await withSiteBuilder('site-with-shadowing-404-redirect-existing', async builder => {
    builder
      .withContentFile({
        path: 'foo.html',
        content: '<html><h1>foo',
      })
      .withContentFile({
        path: 'test-404.html',
        content: '<html><h1>This page actually exists',
      })
      .withNetlifyToml({
        config: {
          redirects: [{ from: '/test-404', to: '/foo', status: 404 }],
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/test-404`)

    t.is(response.status, 200)
    t.is(await response.text(), '<html><h1>This page actually exists')

    server.close()
  })
})

test('should follow 404 redirect even with existing file when force=true', async t => {
  await withSiteBuilder('site-with-shadowing-404-redirect-force', async builder => {
    builder
      .withContentFile({
        path: 'foo.html',
        content: '<html><h1>foo',
      })
      .withContentFile({
        path: 'test-404.html',
        content: '<html><h1>This page actually exists',
      })
      .withNetlifyToml({
        config: {
          redirects: [{ from: '/test-404', to: '/foo', status: 404, force: true }],
        },
      })

    await builder.buildAsync()

    const server = await startDevServer({ cwd: builder.directory })

    const response = await fetch(`${server.url}/test-404`)

    t.is(response.status, 404)
    t.is(await response.text(), '<html><h1>foo')

    server.close()
  })
})
