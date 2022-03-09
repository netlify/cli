// Handlers are meant to be async outside tests
/* eslint-disable require-await */
const path = require('path')
const process = require('process')

// eslint-disable-next-line ava/use-test
const avaTest = require('ava')
const { isCI } = require('ci-info')
const FormData = require('form-data')

const { withDevServer } = require('./utils/dev-server')
const got = require('./utils/got')
const { withSiteBuilder } = require('./utils/site-builder')

const test = isCI ? avaTest.serial.bind(avaTest) : avaTest

const testMatrix = [
  { args: [] },

  // some tests are still failing with this enabled
  // { args: ['--edgeHandlers'] }
]

const testName = (title, args) => (args.length <= 0 ? title : `${title} - ${args.join(' ')}`)

testMatrix.forEach(({ args }) => {
  test(testName('should use [build.environment] and not [context.production.environment]', args), async (t) => {
    await withSiteBuilder('site-with-build-environment', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { environment: { TEST: 'DEFAULT_CONTEXT' } },
            context: { production: { environment: { TEST: 'PRODUCTION_CONTEXT' } } },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'env.js',
          handler: async () => ({
            statusCode: 200,
            body: `${process.env.TEST}`,
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        t.is(response, 'DEFAULT_CONTEXT')
      })
    })
  })

  test(testName('should override .env.development with process env', args), async (t) => {
    await withSiteBuilder('site-with-override', async (builder) => {
      builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withEnvFile({ path: '.env.development', env: { TEST: 'FROM_DEV_FILE' } })
        .withFunction({
          path: 'env.js',
          handler: async () => ({
            statusCode: 200,
            body: `${process.env.TEST}`,
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' }, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        t.is(response, 'FROM_PROCESS_ENV')
      })
    })
  })

  test(testName('should override [build.environment] with process env', args), async (t) => {
    await withSiteBuilder('site-with-build-environment-override', async (builder) => {
      builder
        .withNetlifyToml({
          config: { build: { environment: { TEST: 'FROM_CONFIG_FILE' } }, functions: { directory: 'functions' } },
        })
        .withFunction({
          path: 'env.js',
          handler: async () => ({
            statusCode: 200,
            body: `${process.env.TEST}`,
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' }, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        t.is(response, 'FROM_PROCESS_ENV')
      })
    })
  })

  test(testName('should override value of the NETLIFY_DEV env variable', args), async (t) => {
    await withSiteBuilder('site-with-netlify-dev-override', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: async () => ({
          statusCode: 200,
          body: `${process.env.NETLIFY_DEV}`,
        }),
      })

      await builder.buildAsync()

      await withDevServer(
        { cwd: builder.directory, env: { NETLIFY_DEV: 'FROM_PROCESS_ENV' }, args },
        async (server) => {
          const response = await got(`${server.url}/.netlify/functions/env`).text()
          t.is(response, 'true')
        },
      )
    })
  })

  test(testName('should set value of the CONTEXT env variable', args), async (t) => {
    await withSiteBuilder('site-with-context-override', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: async () => ({
          statusCode: 200,
          body: `${process.env.CONTEXT}`,
        }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        t.is(response, 'dev')
      })
    })
  })

  test(testName('should replicate Lambda behaviour for synchronous return values', args), async (t) => {
    await withSiteBuilder('site-replicate-aws-sync-behaviour', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: () => ({
          statusCode: 200,
        }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`, {
          throwHttpErrors: false,
        })
        t.true(response.body.startsWith('no lambda response.'))
      })
    })
  })

  test(testName('should redirect using a wildcard when set in netlify.toml', args), async (t) => {
    await withSiteBuilder('site-with-redirect-function', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'ping.js',
          handler: async () => ({
            statusCode: 200,
            body: 'ping',
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/api/ping`).text()
        t.is(response, 'ping')
      })
    })
  })

  test(testName('should pass undefined body to functions event for GET requests when redirecting', args), async (t) => {
    await withSiteBuilder('site-with-get-echo-function', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/api/echo?ding=dong`).json()
        t.is(response.body, undefined)
        t.is(response.headers.host, `${server.host}:${server.port}`)
        t.is(response.httpMethod, 'GET')
        t.is(response.isBase64Encoded, true)
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
            functions: { directory: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got
          .post(`${server.url}/api/echo?ding=dong`, {
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: 'some=thing',
          })
          .json()

        t.is(response.body, 'some=thing')
        t.is(response.headers.host, `${server.host}:${server.port}`)
        t.is(response.headers['content-type'], 'application/x-www-form-urlencoded')
        t.is(response.headers['content-length'], '10')
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
            functions: { directory: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async () => ({
            statusCode: 200,
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got.post(`${server.url}/api/echo?ding=dong`, {
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: 'some=thing',
        })

        t.is(response.body, '')
        t.is(response.statusCode, 200)
      })
    })
  })

  test(testName('should handle multipart form data when redirecting', args), async (t) => {
    await withSiteBuilder('site-with-multi-part-function', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const form = new FormData()
        form.append('some', 'thing')

        const expectedBoundary = form.getBoundary()
        const expectedResponseBody = form.getBuffer().toString('base64')

        const response = await got
          .post(`${server.url}/api/echo?ding=dong`, {
            body: form,
          })
          .json()

        t.is(response.headers.host, `${server.host}:${server.port}`)
        t.is(response.headers['content-type'], `multipart/form-data; boundary=${expectedBoundary}`)
        t.is(response.headers['content-length'], '164')
        t.is(response.httpMethod, 'POST')
        t.is(response.isBase64Encoded, true)
        t.is(response.path, '/api/echo')
        t.deepEqual(response.queryStringParameters, { ding: 'dong' })
        t.is(response.body, expectedResponseBody)
      })
    })
  })

  test(testName('should return 404 when redirecting to a non existing function', args), async (t) => {
    await withSiteBuilder('site-with-missing-function', async (builder) => {
      builder.withNetlifyToml({
        config: {
          functions: { directory: 'functions' },
          redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
        },
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got
          .post(`${server.url}/api/none`, {
            body: 'nothing',
          })
          .catch((error) => error.response)

        t.is(response.statusCode, 404)
      })
    })
  })

  test(testName('should parse function query parameters using simple parsing', args), async (t) => {
    await withSiteBuilder('site-with-multi-part-function', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response1 = await got(`${server.url}/.netlify/functions/echo?category[SOMETHING][]=something`).json()
        const response2 = await got(`${server.url}/.netlify/functions/echo?category=one&category=two`).json()

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
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'submission-created.js',
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const form = new FormData()
        form.append('some', 'thing')
        const response = await got
          .post(`${server.url}/?ding=dong`, {
            body: form,
          })
          .json()

        const body = JSON.parse(response.body)

        t.is(response.headers.host, `${server.host}:${server.port}`)
        t.is(response.headers['content-length'], '276')
        t.is(response.headers['content-type'], 'application/json')
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
              user_agent: 'got (https://github.com/sindresorhus/got)',
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
            site_url: '',
          },
        })
      })
    })
  })

  test(testName('should handle form submission with a background function', args), async (t) => {
    await withSiteBuilder('site-with-form-background-function', async (builder) => {
      await builder
        .withContentFile({
          path: 'index.html',
          content: '<h1>⊂◉‿◉つ</h1>',
        })
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'submission-created-background.js',
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const form = new FormData()
        form.append('some', 'thing')
        const response = await got.post(`${server.url}/?ding=dong`, {
          body: form,
        })
        t.is(response.statusCode, 202)
        t.is(response.body, '')
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
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'submission-created.js',
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got
          .post(`${server.url}/?ding=dong`, {
            body: 'Something',
            headers: {
              'content-type': 'text/plain',
            },
          })
          .catch((error) => error.response)
        t.is(response.body, 'Method Not Allowed')
      })
    })
  })

  test(testName('should return existing local file even when rewrite matches when force=false', args), async (t) => {
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
        const response = await got(`${server.url}/foo?ping=pong`).text()
        t.is(response, '<html><h1>foo')
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
            redirects: [{ from: '/foo', to: '/not-foo', status: 301, force: false }],
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/foo?ping=pong`).text()
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
        const response = await got(`${server.url}/foo`).text()
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
        const response = await got(`${server.url}/foo.html`).text()
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
        const response = await got(`${server.url}/foo.html`).text()
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
        const response1 = await got(`${server.url}/not-foo`).text()
        const response2 = await got(`${server.url}/not-foo/`).text()

        // TODO: check why this doesn't redirect
        const response3 = await got(`${server.url}/not-foo/index.html`).text()

        t.is(response1, '<html><h1>foo')
        t.is(response2, '<html><h1>foo')
        t.is(response3, '<html><h1>not-foo')
      })
    })
  })
})
/* eslint-enable require-await */
