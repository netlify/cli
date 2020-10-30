'use strict'

// Handlers are meant to be async outside tests
/* eslint-disable require-await */
const http = require('http')
const path = require('path')
const process = require('process')

const test = require('ava')
const FormData = require('form-data')
const fetch = require('node-fetch')

const { withDevServer } = require('./utils/dev-server')
const { startExternalServer } = require('./utils/external-server')
const { withSiteBuilder } = require('./utils/site-builder')

const testMatrix = [
  { args: [] },

  // some tests are still failing with this enabled
  // { args: ['--trafficMesh'] }
]

const testName = (title, args) => (args.length <= 0 ? title : `${title} - ${args.join(' ')}`)

testMatrix.forEach(({ args }) => {
  test(testName('should return index file when / is accessed', args), async (t) => {
    await withSiteBuilder('site-with-index-file', async (builder) => {
      builder.withContentFile({
        path: 'index.html',
        content: '<h1>⊂◉‿◉つ</h1>',
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(server.url).then((res) => res.text())
        t.is(response, '<h1>⊂◉‿◉つ</h1>')
      })
    })
  })

  test(testName('should return response from a function with setTimeout', args), async (t) => {
    await withSiteBuilder('site-with-set-timeout-function', async (builder) => {
      builder.withNetlifyToml({ config: { build: { functions: 'functions' } } }).withFunction({
        path: 'timeout.js',
        handler: async () => {
          console.log('ding')
          // Wait for 4 seconds
          const FUNCTION_TIMEOUT = 4e3
          await new Promise((resolve) => {
            setTimeout(resolve, FUNCTION_TIMEOUT)
          })
          return {
            statusCode: 200,
            body: 'ping',
          }
        },
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/timeout`).then((res) => res.text())
        t.is(response, 'ping')
      })
    })
  })

  test(testName('should serve function from a subdirectory', args), async (t) => {
    await withSiteBuilder('site-with-from-subdirectory', async (builder) => {
      builder.withNetlifyToml({ config: { build: { functions: 'functions' } } }).withFunction({
        path: path.join('echo', 'echo.js'),
        handler: async () => {
          return {
            statusCode: 200,
            body: 'ping',
          }
        },
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/echo`).then((res) => res.text())
        t.is(response, 'ping')
      })
    })
  })

  test(testName('should pass .env.development vars to function', args), async (t) => {
    await withSiteBuilder('site-with-env-development', async (builder) => {
      builder
        .withNetlifyToml({ config: { build: { functions: 'functions' } } })
        .withEnvFile({ path: '.env.development', env: { TEST: 'FROM_DEV_FILE' } })
        .withFunction({
          path: 'env.js',
          handler: async () => {
            return {
              statusCode: 200,
              body: `${process.env.TEST}`,
            }
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.is(response, 'FROM_DEV_FILE')
      })
    })
  })

  test(testName('should pass process env vars to function', args), async (t) => {
    await withSiteBuilder('site-with-process-env', async (builder) => {
      builder.withNetlifyToml({ config: { build: { functions: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: async () => {
          return {
            statusCode: 200,
            body: `${process.env.TEST}`,
          }
        },
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' }, args }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.is(response, 'FROM_PROCESS_ENV')
      })
    })
  })

  test(testName('should override .env.development with process env', args), async (t) => {
    await withSiteBuilder('site-with-override', async (builder) => {
      builder
        .withNetlifyToml({ config: { build: { functions: 'functions' } } })
        .withEnvFile({ path: '.env.development', env: { TEST: 'FROM_DEV_FILE' } })
        .withFunction({
          path: 'env.js',
          handler: async () => {
            return {
              statusCode: 200,
              body: `${process.env.TEST}`,
            }
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' }, args }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.is(response, 'FROM_PROCESS_ENV')
      })
    })
  })

  test(testName('should redirect using a wildcard when set in netlify.toml', args), async (t) => {
    await withSiteBuilder('site-with-redirect-function', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { functions: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'ping.js',
          handler: async () => {
            return {
              statusCode: 200,
              body: 'ping',
            }
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/api/ping`).then((res) => res.text())
        t.is(response, 'ping')
      })
    })
  })

  test(testName('should pass undefined body to functions event for GET requests when redirecting', args), async (t) => {
    await withSiteBuilder('site-with-get-echo-function', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { functions: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event) => {
            return {
              statusCode: 200,
              body: JSON.stringify(event),
            }
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/api/echo?ding=dong`).then((res) => res.json())
        t.is(response.body, undefined)
        t.deepEqual(response.headers, {
          accept: '*/*',
          'accept-encoding': 'gzip,deflate',
          'client-ip': '127.0.0.1',
          connection: 'close',
          host: `${server.host}:${server.port}`,
          'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
          'x-forwarded-for': '::ffff:127.0.0.1',
        })
        t.is(response.httpMethod, 'GET')
        t.is(response.isBase64Encoded, false)
        t.is(response.path, '/api/echo')
        t.deepEqual(response.queryStringParameters, { ding: 'dong' })
      })
    })
  })

  test(testName('should pass body to functions event for POST requests when redirecting', args), async (t) => {
    await withSiteBuilder('site-with-post-echo-function', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { functions: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event) => {
            return {
              statusCode: 200,
              body: JSON.stringify(event),
            }
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/api/echo?ding=dong`, {
          method: 'POST',
          body: 'some=thing',
        }).then((res) => res.json())

        t.is(response.body, 'some=thing')
        t.deepEqual(response.headers, {
          accept: '*/*',
          'accept-encoding': 'gzip,deflate',
          'client-ip': '127.0.0.1',
          connection: 'close',
          host: `${server.host}:${server.port}`,
          'content-type': 'text/plain;charset=UTF-8',
          'content-length': '10',
          'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
          'x-forwarded-for': '::ffff:127.0.0.1',
        })
        t.is(response.httpMethod, 'POST')
        t.is(response.isBase64Encoded, false)
        t.is(response.path, '/api/echo')
        t.deepEqual(response.queryStringParameters, { ding: 'dong' })
      })
    })
  })

  test(testName('should return an empty body for a function with no body when redirecting', args), async (t) => {
    await withSiteBuilder('site-with-no-body-function', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { functions: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async () => {
            return {
              statusCode: 200,
            }
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/api/echo?ding=dong`, {
          method: 'POST',
          body: 'some=thing',
        })

        t.is(await response.text(), '')
        t.is(response.status, 200)
      })
    })
  })

  test(testName('should handle multipart form data when redirecting', args), async (t) => {
    await withSiteBuilder('site-with-multi-part-function', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { functions: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event) => {
            return {
              statusCode: 200,
              body: JSON.stringify(event),
            }
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const form = new FormData()
        form.append('some', 'thing')

        const response = await fetch(`${server.url}/api/echo?ding=dong`, {
          method: 'POST',
          body: form.getBuffer(),
          headers: form.getHeaders(),
        }).then((res) => res.json())

        const formBoundary = form.getBoundary()

        t.deepEqual(response.headers, {
          accept: '*/*',
          'accept-encoding': 'gzip,deflate',
          'client-ip': '127.0.0.1',
          connection: 'close',
          host: `${server.host}:${server.port}`,
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
      })
    })
  })

  test(testName('should return 404 when redirecting to a non existing function', args), async (t) => {
    await withSiteBuilder('site-with-multi-part-function', async (builder) => {
      builder.withNetlifyToml({
        config: {
          build: { functions: 'functions' },
          redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
        },
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/api/none`, {
          method: 'POST',
          body: 'nothing',
        })

        t.is(response.status, 404)
      })
    })
  })

  test(testName('should parse function query parameters using simple parsing', args), async (t) => {
    await withSiteBuilder('site-with-multi-part-function', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { functions: 'functions' },
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event) => {
            return {
              statusCode: 200,
              body: JSON.stringify(event),
            }
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response1 = await fetch(
          `${server.url}/.netlify/functions/echo?category[SOMETHING][]=something`,
        ).then((res) => res.json())
        const response2 = await fetch(`${server.url}/.netlify/functions/echo?category=one&category=two`).then((res) =>
          res.json(),
        )

        t.deepEqual(response1.queryStringParameters, { 'category[SOMETHING][]': 'something' })
        t.deepEqual(response2.queryStringParameters, { category: 'one, two' })
      })
    })
  })

  test(testName('should handle form submission', args), async (t) => {
    await withSiteBuilder('site-with-form', async (builder) => {
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
          handler: async (event) => {
            return {
              statusCode: 200,
              body: JSON.stringify(event),
            }
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const form = new FormData()
        form.append('some', 'thing')
        const response = await fetch(`${server.url}/?ding=dong`, {
          method: 'POST',
          body: form.getBuffer(),
          headers: form.getHeaders(),
        }).then((res) => res.json())

        const body = JSON.parse(response.body)

        t.deepEqual(response.headers, {
          accept: '*/*',
          'accept-encoding': 'gzip,deflate',
          'client-ip': '127.0.0.1',
          connection: 'close',
          host: `${server.host}:${server.port}`,
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
      })
    })
  })

  test(testName('should not handle form submission when content type is `text/plain`', args), async (t) => {
    await withSiteBuilder('site-with-form-text-plain', async (builder) => {
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
          handler: async (event) => {
            return {
              statusCode: 200,
              body: JSON.stringify(event),
            }
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/?ding=dong`, {
          method: 'POST',
          body: 'Something',
          headers: {
            'content-type': 'text/plain',
          },
        }).then((res) => res.text())
        t.is(response, 'Method Not Allowed')
      })
    })
  })

  test(testName('should return existing local file even when redirect matches when force=false', args), async (t) => {
    await withSiteBuilder('site-with-shadowing-force-false', async (builder) => {
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

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/foo?ping=pong`).then((res) => res.text())
        t.is(response, '<html><h1>foo')
      })
    })
  })

  test(testName('should ignore existing local file when redirect matches and force=true', args), async (t) => {
    await withSiteBuilder('site-with-shadowing-force-true', async (builder) => {
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

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/foo`).then((res) => res.text())
        t.is(response, '<html><h1>not-foo')
      })
    })
  })

  test(testName('should use existing file when rule contains file extension and force=false', args), async (t) => {
    await withSiteBuilder('site-with-shadowing-file-extension-force-false', async (builder) => {
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

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/foo.html`).then((res) => res.text())
        t.is(response, '<html><h1>foo')
      })
    })
  })

  test(testName('should redirect when rule contains file extension and force=true', args), async (t) => {
    await withSiteBuilder('site-with-shadowing-file-extension-force-true', async (builder) => {
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

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/foo.html`).then((res) => res.text())
        t.is(response, '<html><h1>not-foo')
      })
    })
  })

  test(testName('should redirect from sub directory to root directory', args), async (t) => {
    await withSiteBuilder('site-with-shadowing-sub-to-root', async (builder) => {
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

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response1 = await fetch(`${server.url}/not-foo`).then((res) => res.text())
        const response2 = await fetch(`${server.url}/not-foo/`).then((res) => res.text())

        // TODO: check why this doesn't redirect
        const response3 = await fetch(`${server.url}/not-foo/index.html`).then((res) => res.text())

        t.is(response1, '<html><h1>foo')
        t.is(response2, '<html><h1>foo')
        t.is(response3, '<html><h1>not-foo')
      })
    })
  })

  test(testName('should return 404.html if exists for non existing routes', args), async (t) => {
    await withSiteBuilder('site-with-shadowing-404', async (builder) => {
      builder.withContentFile({
        path: '404.html',
        content: '<h1>404 - Page not found</h1>',
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/non-existent`).then((res) => res.text())
        t.is(response, '<h1>404 - Page not found</h1>')
      })
    })
  })

  test(testName('should return 404.html from publish folder if exists for non existing routes', args), async (t) => {
    await withSiteBuilder('site-with-shadowing-404-in-publish-folder', async (builder) => {
      builder
        .withContentFile({
          path: 'public/404.html',
          content: '<h1>404 - My Custom 404 Page</h1>',
        })
        .withNetlifyToml({
          config: {
            build: {
              publish: 'public/',
            },
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/non-existent`)
        t.is(response.status, 404)
        t.is(await response.text(), '<h1>404 - My Custom 404 Page</h1>')
      })
    })
  })

  test(testName('should return 404 for redirect', args), async (t) => {
    await withSiteBuilder('site-with-shadowing-404-redirect', async (builder) => {
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

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/test-404`)
        t.is(response.status, 404)
        t.is(await response.text(), '<html><h1>foo')
      })
    })
  })

  test(testName('should ignore 404 redirect for existing file', args), async (t) => {
    await withSiteBuilder('site-with-shadowing-404-redirect-existing', async (builder) => {
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

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/test-404`)

        t.is(response.status, 200)
        t.is(await response.text(), '<html><h1>This page actually exists')
      })
    })
  })

  test(testName('should follow 404 redirect even with existing file when force=true', args), async (t) => {
    await withSiteBuilder('site-with-shadowing-404-redirect-force', async (builder) => {
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

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/test-404`)

        t.is(response.status, 404)
        t.is(await response.text(), '<html><h1>foo')
      })
    })
  })

  test(testName('should source redirects file from publish directory', args), async (t) => {
    await withSiteBuilder('site-redirects-file-inside-publish', async (builder) => {
      builder
        .withContentFile({
          path: 'public/index.html',
          content: 'index',
        })
        .withRedirectsFile({
          pathPrefix: 'public',
          redirects: [{ from: '/*', to: `/index.html`, status: 200 }],
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/test`)

        t.is(response.status, 200)
        t.is(await response.text(), 'index')
      })
    })
  })

  test(testName('should redirect requests to an external server', args), async (t) => {
    await withSiteBuilder('site-redirects-file-to-external', async (builder) => {
      const externalServer = startExternalServer()
      const { port } = externalServer.address()
      builder.withRedirectsFile({
        redirects: [{ from: '/api/*', to: `http://localhost:${port}/:splat`, status: 200 }],
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const getResponse = await fetch(`${server.url}/api/ping`).then((res) => res.json())
        t.deepEqual(getResponse, { body: {}, method: 'GET', url: '/ping' })

        const postResponse = await fetch(`${server.url}/api/ping`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'param=value',
        }).then((res) => res.json())
        t.deepEqual(postResponse, { body: { param: 'value' }, method: 'POST', url: '/ping' })
      })

      externalServer.close()
    })
  })

  test(testName('should redirect POST request if content-type is missing', args), async (t) => {
    await withSiteBuilder('site-with-post-no-content-type', async (builder) => {
      builder.withNetlifyToml({
        config: {
          build: { functions: 'functions' },
          redirects: [{ from: '/api/*', to: '/other/:splat', status: 200 }],
        },
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const options = {
          host: server.host,
          port: server.port,
          path: '/api/echo',
          method: 'POST',
        }
        let data = ''
        await new Promise((resolve) => {
          const callback = (response) => {
            response.on('data', (chunk) => {
              data += chunk
            })
            response.on('end', resolve)
          }
          const req = http.request(options, callback)
          req.write('param=value')
          req.end()
        })

        // we're testing Netlify Dev didn't crash
        t.is(data, 'Method Not Allowed')
      })
    })
  })

  test(testName('should return .html file when file and folder have the same name', args), async (t) => {
    await withSiteBuilder('site-with-same-name-for-file-and-folder', async (builder) => {
      builder
        .withContentFile({
          path: 'foo.html',
          content: '<html><h1>foo',
        })
        .withContentFile({
          path: 'foo/file.html',
          content: '<html><h1>file in folder',
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/foo`)

        t.is(response.status, 200)
        t.is(await response.text(), '<html><h1>foo')
      })
    })
  })

  test(testName('should not shadow an existing file that has unsafe URL characters', args), async (t) => {
    await withSiteBuilder('site-with-same-name-for-file-and-folder', async (builder) => {
      builder
        .withContentFile({
          path: 'public/index.html',
          content: '<html>index</html>',
        })
        .withContentFile({
          path: 'public/files/file with spaces.html',
          content: '<html>file with spaces</html>',
        })
        .withContentFile({
          path: 'public/files/[file_with_brackets].html',
          content: '<html>file with brackets</html>',
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            redirects: [{ from: '/*', to: '/index.html', status: 200 }],
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const [spaces, brackets] = await Promise.all([
          fetch(`${server.url}/files/file with spaces`).then((res) => res.text()),
          fetch(`${server.url}/files/[file_with_brackets]`).then((res) => res.text()),
        ])

        t.is(spaces, '<html>file with spaces</html>')
        t.is(brackets, '<html>file with brackets</html>')
      })
    })
  })

  test(testName('should follow redirect for fully qualified rule', args), async (t) => {
    await withSiteBuilder('site-with-fully-qualified-redirect-rule', async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: { publish: publicDir },
          },
        })
        .withContentFiles([
          {
            path: path.join(publicDir, 'index.html'),
            content: '<html>index</html>',
          },
          {
            path: path.join(publicDir, 'local-hello.html'),
            content: '<html>hello</html>',
          },
        ])
        .withRedirectsFile({
          redirects: [{ from: `http://localhost/hello-world`, to: `/local-hello`, status: 200 }],
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/hello-world`)

        t.is(response.status, 200)
        t.is(await response.text(), '<html>hello</html>')
      })
    })
  })

  test(testName('should return 202 ok and empty response for background function', args), async (t) => {
    await withSiteBuilder('site-with-background-function', async (builder) => {
      builder.withNetlifyToml({ config: { build: { functions: 'functions' } } }).withFunction({
        path: 'hello-background.js',
        handler: () => {
          console.log("Look at me I'm a background task")
        },
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/hello-background`)
        const text = await response.text()
        const expectedStatueCode = 202
        t.is(response.status, expectedStatueCode)
        t.is(text, '')
      })
    })
  })
})
/* eslint-enable require-await */
