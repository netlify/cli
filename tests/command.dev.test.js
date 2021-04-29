// Handlers are meant to be async outside tests
/* eslint-disable require-await */
const http = require('http')
const path = require('path')
const process = require('process')

// eslint-disable-next-line ava/use-test
const avaTest = require('ava')
const dotProp = require('dot-prop')
const FormData = require('form-data')
const jwt = require('jsonwebtoken')

const { copyFileAsync } = require('../src/lib/fs')

const { withDevServer } = require('./utils/dev-server')
const { startExternalServer } = require('./utils/external-server')
const got = require('./utils/got')
const { withMockApi } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')

const gotCatch404 = async (url, options) => {
  try {
    return await got(url, options)
  } catch (error) {
    if (error.response && error.response.statusCode === 404) {
      return error.response
    }
    throw error
  }
}

const test = process.env.CI === 'true' ? avaTest.serial.bind(avaTest) : avaTest

const testMatrix = [
  { args: [] },

  // some tests are still failing with this enabled
  // { args: ['--edgeHandlers'] }
]

const testName = (title, args) => (args.length <= 0 ? title : `${title} - ${args.join(' ')}`)

const JWT_EXPIRY = 1893456000
const getToken = ({ roles, jwtSecret = 'secret', jwtRolePath = 'app_metadata.authorization.roles' }) => {
  const payload = {
    exp: JWT_EXPIRY,
    sub: '12345678',
  }
  return jwt.sign(dotProp.set(payload, jwtRolePath, roles), jwtSecret)
}

const setupRoleBasedRedirectsSite = (builder) => {
  builder
    .withContentFiles([
      {
        path: 'index.html',
        content: '<html>index</html>',
      },
      {
        path: 'admin/foo.html',
        content: '<html>foo</html>',
      },
    ])
    .withRedirectsFile({
      redirects: [{ from: `/admin/*`, to: ``, status: '200!', condition: 'Role=admin' }],
    })
  return builder
}

const validateRoleBasedRedirectsSite = async ({ builder, args, t, jwtSecret, jwtRolePath }) => {
  const adminToken = getToken({ jwtSecret, jwtRolePath, roles: ['admin'] })
  const editorToken = getToken({ jwtSecret, jwtRolePath, roles: ['editor'] })

  await withDevServer({ cwd: builder.directory, args }, async (server) => {
    const unauthenticatedResponse = await gotCatch404(`${server.url}/admin`)
    t.is(unauthenticatedResponse.statusCode, 404)
    t.is(unauthenticatedResponse.body, 'Not Found')

    const authenticatedResponse = await got(`${server.url}/admin/foo`, {
      headers: {
        cookie: `nf_jwt=${adminToken}`,
      },
    })
    t.is(authenticatedResponse.statusCode, 200)
    t.is(authenticatedResponse.body, '<html>foo</html>')

    const wrongRoleResponse = await gotCatch404(`${server.url}/admin/foo`, {
      headers: {
        cookie: `nf_jwt=${editorToken}`,
      },
    })
    t.is(wrongRoleResponse.statusCode, 404)
    t.is(wrongRoleResponse.body, 'Not Found')
  })
}

testMatrix.forEach(({ args }) => {
  test(testName('should return index file when / is accessed', args), async (t) => {
    await withSiteBuilder('site-with-index-file', async (builder) => {
      builder.withContentFile({
        path: 'index.html',
        content: '<h1>⊂◉‿◉つ</h1>',
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(server.url).text()
        t.is(response, '<h1>⊂◉‿◉つ</h1>')
      })
    })
  })

  test(testName('should return user defined headers when / is accessed', args), async (t) => {
    await withSiteBuilder('site-with-headers-on-root', async (builder) => {
      builder.withContentFile({
        path: 'index.html',
        content: '<h1>⊂◉‿◉つ</h1>',
      })

      const headerName = 'X-Frame-Options'
      const headerValue = 'SAMEORIGIN'
      builder.withHeadersFile({ headers: [{ path: '/*', headers: [`${headerName}: ${headerValue}`] }] })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const { headers } = await got(server.url)
        t.is(headers[headerName.toLowerCase()], headerValue)
      })
    })
  })

  test(testName('should return user defined headers when non-root path is accessed', args), async (t) => {
    await withSiteBuilder('site-with-headers-on-non-root', async (builder) => {
      builder.withContentFile({
        path: 'foo/index.html',
        content: '<h1>⊂◉‿◉つ</h1>',
      })

      const headerName = 'X-Frame-Options'
      const headerValue = 'SAMEORIGIN'
      builder.withHeadersFile({ headers: [{ path: '/*', headers: [`${headerName}: ${headerValue}`] }] })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const { headers } = await got(`${server.url}/foo`)
        t.is(headers[headerName.toLowerCase()], headerValue)
      })
    })
  })

  test(testName('should return response from a function with setTimeout', args), async (t) => {
    await withSiteBuilder('site-with-set-timeout-function', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
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
        const response = await got(`${server.url}/.netlify/functions/timeout`).text()
        t.is(response, 'ping')
      })
    })
  })

  test(testName('should serve function from a subdirectory', args), async (t) => {
    await withSiteBuilder('site-with-from-subdirectory', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: path.join('echo', 'echo.js'),
        handler: async () => ({
          statusCode: 200,
          body: 'ping',
        }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/echo`).text()
        t.is(response, 'ping')
      })
    })
  })

  test(testName('should pass .env.development vars to function', args), async (t) => {
    await withSiteBuilder('site-with-env-development', async (builder) => {
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

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        t.is(response, 'FROM_DEV_FILE')
      })
    })
  })

  test(testName('should pass process env vars to function', args), async (t) => {
    await withSiteBuilder('site-with-process-env', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
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

  test(testName('should pass [build.environment] env vars to function', args), async (t) => {
    await withSiteBuilder('site-with-build-environment', async (builder) => {
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

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        t.is(response, 'FROM_CONFIG_FILE')
      })
    })
  })

  test(testName('[context.dev.environment] should override [build.environment]', args), async (t) => {
    await withSiteBuilder('site-with-build-environment', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { environment: { TEST: 'DEFAULT_CONTEXT' } },
            context: { dev: { environment: { TEST: 'DEV_CONTEXT' } } },
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
        t.is(response, 'DEV_CONTEXT')
      })
    })
  })

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
        const expectedResponseBody = form.getBuffer().toString()

        const response = await got
          .post(`${server.url}/api/echo?ding=dong`, {
            body: form,
          })
          .json()

        t.is(response.headers.host, `${server.host}:${server.port}`)
        t.is(response.headers['content-type'], `multipart/form-data; boundary=${expectedBoundary}`)
        t.is(response.headers['content-length'], '164')
        t.is(response.httpMethod, 'POST')
        t.is(response.isBase64Encoded, false)
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

  test(testName('should return 404.html if exists for non existing routes', args), async (t) => {
    await withSiteBuilder('site-with-shadowing-404', async (builder) => {
      builder.withContentFile({
        path: '404.html',
        content: '<h1>404 - Page not found</h1>',
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await gotCatch404(`${server.url}/non-existent`)
        t.is(response.body, '<h1>404 - Page not found</h1>')
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
        const response = await gotCatch404(`${server.url}/non-existent`)
        t.is(response.statusCode, 404)
        t.is(response.body, '<h1>404 - My Custom 404 Page</h1>')
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
        const response = await gotCatch404(`${server.url}/test-404`)
        t.is(response.statusCode, 404)
        t.is(response.body, '<html><h1>foo')
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
        const response = await got(`${server.url}/test-404`)

        t.is(response.statusCode, 200)
        t.is(response.body, '<html><h1>This page actually exists')
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
        const response = await gotCatch404(`${server.url}/test-404`)

        t.is(response.statusCode, 404)
        t.is(response.body, '<html><h1>foo')
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
        const response = await got(`${server.url}/test`)

        t.is(response.statusCode, 200)
        t.is(response.body, 'index')
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
        const getResponse = await got(`${server.url}/api/ping`).json()
        t.deepEqual(getResponse, { body: {}, method: 'GET', url: '/ping' })

        const postResponse = await got
          .post(`${server.url}/api/ping`, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'param=value',
          })
          .json()
        t.deepEqual(postResponse, { body: { param: 'value' }, method: 'POST', url: '/ping' })
      })

      externalServer.close()
    })
  })

  test(testName('should redirect POST request if content-type is missing', args), async (t) => {
    await withSiteBuilder('site-with-post-no-content-type', async (builder) => {
      builder.withNetlifyToml({
        config: {
          functions: { directory: 'functions' },
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
        const response = await got(`${server.url}/foo`)

        t.is(response.statusCode, 200)
        t.is(response.body, '<html><h1>foo')
      })
    })
  })

  test(testName('should not shadow an existing file that has unsafe URL characters', args), async (t) => {
    await withSiteBuilder('site-with-unsafe-url-file-names', async (builder) => {
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
          got(`${server.url}/files/file with spaces`).text(),
          got(`${server.url}/files/[file_with_brackets]`).text(),
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
        const response = await got(`${server.url}/hello-world`)

        t.is(response.statusCode, 200)
        t.is(response.body, '<html>hello</html>')
      })
    })
  })

  test(testName('should return 202 ok and empty response for background function', args), async (t) => {
    await withSiteBuilder('site-with-background-function', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'hello-background.js',
        handler: () => {
          console.log("Look at me I'm a background task")
        },
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/hello-background`)
        t.is(response.statusCode, 202)
        t.is(response.body, '')
      })
    })
  })

  test(testName('should enforce role based redirects with default secret and role path', args), async (t) => {
    await withSiteBuilder('site-with-default-role-based-redirects', async (builder) => {
      setupRoleBasedRedirectsSite(builder)
      await builder.buildAsync()
      await validateRoleBasedRedirectsSite({ builder, args, t })
    })
  })

  test(testName('should enforce role based redirects with custom secret and role path', args), async (t) => {
    await withSiteBuilder('site-with-custom-role-based-redirects', async (builder) => {
      const jwtSecret = 'custom'
      const jwtRolePath = 'roles'
      setupRoleBasedRedirectsSite(builder).withNetlifyToml({
        config: {
          dev: {
            jwtSecret,
            jwtRolePath,
          },
        },
      })
      await builder.buildAsync()
      await validateRoleBasedRedirectsSite({ builder, args, t, jwtSecret, jwtRolePath })
    })
  })

  // the edge handlers plugin only works on node >= 10
  const version = Number.parseInt(process.version.slice(1).split('.')[0])
  const EDGE_HANDLER_MIN_VERSION = 10
  if (version >= EDGE_HANDLER_MIN_VERSION) {
    test(testName('should serve edge handlers with --edgeHandlers flag', args), async (t) => {
      await withSiteBuilder('site-with-fully-qualified-redirect-rule', async (builder) => {
        const publicDir = 'public'
        builder
          .withNetlifyToml({
            config: {
              build: { publish: publicDir },
              redirects: [
                {
                  from: '/edge-handler',
                  to: 'index.html',
                  status: 200,
                  edge_handler: 'smoke',
                  force: true,
                },
              ],
            },
          })
          .withContentFiles([
            {
              path: path.join(publicDir, 'index.html'),
              content: '<html>index</html>',
            },
          ])
          .withEdgeHandlers({
            fileName: 'smoke.js',
            handlers: {
              onRequest: (event) => {
                event.replaceResponse(
                  // eslint-disable-next-line no-undef
                  new Response(null, {
                    headers: {
                      Location: 'https://google.com/',
                    },
                    status: 301,
                  }),
                )
              },
            },
          })

        await builder.buildAsync()

        await withDevServer({ cwd: builder.directory, args: [...args, '--edgeHandlers'] }, async (server) => {
          const response = await got(`${server.url}/edge-handler`, {
            followRedirect: false,
          })

          t.is(response.statusCode, 301)
          t.is(response.headers.location, 'https://google.com/')
        })
      })
    })

    test(testName('should serve edge handlers with deprecated --trafficMesh flag', args), async (t) => {
      await withSiteBuilder('site-with-fully-qualified-redirect-rule', async (builder) => {
        const publicDir = 'public'
        builder
          .withNetlifyToml({
            config: {
              build: { publish: publicDir },
              redirects: [
                {
                  from: '/edge-handler',
                  to: 'index.html',
                  status: 200,
                  edge_handler: 'smoke',
                  force: true,
                },
              ],
            },
          })
          .withContentFiles([
            {
              path: path.join(publicDir, 'index.html'),
              content: '<html>index</html>',
            },
          ])
          .withEdgeHandlers({
            fileName: 'smoke.js',
            handlers: {
              onRequest: (event) => {
                event.replaceResponse(
                  // eslint-disable-next-line no-undef
                  new Response(null, {
                    headers: {
                      Location: 'https://google.com/',
                    },
                    status: 301,
                  }),
                )
              },
            },
          })

        await builder.buildAsync()

        await withDevServer({ cwd: builder.directory, args: [...args, '--trafficMesh'] }, async (server) => {
          const response = await got(`${server.url}/edge-handler`, {
            followRedirect: false,
          })

          t.is(response.statusCode, 301)
          t.is(response.headers.location, 'https://google.com/')
        })
      })
    })

    test(testName('mesh-forward builds projects w/o edge handlers', args), async (t) => {
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
          ])

        await builder.buildAsync()

        await withDevServer({ cwd: builder.directory, args: [...args, '--edgeHandlers'] }, async (server) => {
          const response = await got(`${server.url}/index.html`)

          t.is(response.statusCode, 200)
        })
      })
    })

    test(testName('redirect with country cookie', args), async (t) => {
      await withSiteBuilder('site-with-country-cookie', async (builder) => {
        builder
          .withContentFiles([
            {
              path: 'index.html',
              content: '<html>index</html>',
            },
            {
              path: 'index-es.html',
              content: '<html>index in spanish</html>',
            },
          ])
          .withRedirectsFile({
            redirects: [{ from: `/`, to: `/index-es.html`, status: '200!', condition: 'Country=ES' }],
          })

        await builder.buildAsync()

        await withDevServer({ cwd: builder.directory, args }, async (server) => {
          const response = await got(`${server.url}/`, {
            headers: {
              cookie: `nf_country=ES`,
            },
          })
          t.is(response.statusCode, 200)
          t.is(response.body, '<html>index in spanish</html>')
        })
      })
    })

    test(testName(`doesn't hang when sending a application/json POST request to function server`, args), async (t) => {
      await withSiteBuilder('site-with-functions', async (builder) => {
        const functionsPort = 6666
        await builder
          .withNetlifyToml({ config: { functions: { directory: 'functions' }, dev: { functionsPort } } })
          .buildAsync()

        await withDevServer({ cwd: builder.directory, args }, async ({ url, port }) => {
          const response = await gotCatch404(`${url.replace(port, functionsPort)}/test`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: '{}',
          })
          t.is(response.statusCode, 404)
          t.is(response.body, 'Function not found...')
        })
      })
    })

    test(testName('should handle query params in redirects', args), async (t) => {
      await withSiteBuilder('site-with-query-redirects', async (builder) => {
        await builder
          .withContentFile({
            path: 'public/index.html',
            content: 'home',
          })
          .withNetlifyToml({
            config: {
              build: { publish: 'public' },
              functions: { directory: 'functions' },
            },
          })
          .withRedirectsFile({
            redirects: [
              { from: `/api/*`, to: `/.netlify/functions/echo?a=1&a=2`, status: '200' },
              { from: `/foo`, to: `/`, status: '302' },
              { from: `/bar`, to: `/?a=1&a=2`, status: '302' },
              { from: `/test id=:id`, to: `/?param=:id` },
            ],
          })
          .withFunction({
            path: 'echo.js',
            handler: async (event) => ({
              statusCode: 200,
              body: JSON.stringify(event),
            }),
          })
          .buildAsync()

        await withDevServer({ cwd: builder.directory, args }, async (server) => {
          const [fromFunction, queryPassthrough, queryInRedirect, withParamMatching] = await Promise.all([
            got(`${server.url}/api/test?foo=1&foo=2&bar=1&bar=2`).json(),
            got(`${server.url}/foo?foo=1&foo=2&bar=1&bar=2`, { followRedirect: false }),
            got(`${server.url}/bar?foo=1&foo=2&bar=1&bar=2`, { followRedirect: false }),
            got(`${server.url}/test?id=1`, { followRedirect: false }),
          ])

          // query params should be taken from the request
          t.deepEqual(fromFunction.multiValueQueryStringParameters, { foo: ['1', '2'], bar: ['1', '2'] })

          // query params should be passed through from the request
          t.is(queryPassthrough.headers.location, '/?foo=1&foo=2&bar=1&bar=2')

          // query params should be taken from the redirect rule
          t.is(queryInRedirect.headers.location, '/?a=1&a=2')

          // query params should be taken from the redirect rule
          t.is(withParamMatching.headers.location, '/?param=1')
        })
      })
    })

    test(testName('Should not use the ZISI function bundler if not using esbuild', args), async (t) => {
      await withSiteBuilder('site-with-esm-function', async (builder) => {
        builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withContentFile({
          path: path.join('functions', 'esm-function', 'esm-function.js'),
          content: `
export async function handler(event, context) {
  return {
    statusCode: 200,
    body: 'esm',
  };
}
    `,
        })

        await builder.buildAsync()

        await t.throwsAsync(() =>
          withDevServer({ cwd: builder.directory, args }, async (server) =>
            got(`${server.url}/.netlify/functions/esm-function`).text(),
          ),
        )
      })
    })

    test(testName('Should use the ZISI function bundler and serve ESM functions if using esbuild', args), async (t) => {
      await withSiteBuilder('site-with-esm-function', async (builder) => {
        builder
          .withNetlifyToml({ config: { functions: { directory: 'functions', node_bundler: 'esbuild' } } })
          .withContentFile({
            path: path.join('functions', 'esm-function', 'esm-function.js'),
            content: `
export async function handler(event, context) {
  return {
    statusCode: 200,
    body: 'esm',
  };
}
    `,
          })

        await builder.buildAsync()

        await withDevServer({ cwd: builder.directory, args }, async (server) => {
          const response = await got(`${server.url}/.netlify/functions/esm-function`).text()
          t.is(response, 'esm')
        })
      })
    })

    test(
      testName('Should use the ZISI function bundler and serve TypeScript functions if using esbuild', args),
      async (t) => {
        await withSiteBuilder('site-with-ts-function', async (builder) => {
          builder
            .withNetlifyToml({ config: { functions: { directory: 'functions', node_bundler: 'esbuild' } } })
            .withContentFile({
              path: path.join('functions', 'ts-function', 'ts-function.ts'),
              content: `
type CustomResponse = string;

export const handler = async function () {
  const response: CustomResponse = "ts";

  return {
    statusCode: 200,
    body: response,
  };
};

    `,
            })

          await builder.buildAsync()

          await withDevServer({ cwd: builder.directory, args }, async (server) => {
            const response = await got(`${server.url}/.netlify/functions/ts-function`).text()
            t.is(response, 'ts')
          })
        })
      },
    )

    test(
      testName('Should use the ZISI function bundler and serve TypeScript functions if not using esbuild', args),
      async (t) => {
        await withSiteBuilder('site-with-ts-function', async (builder) => {
          builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withContentFile({
            path: path.join('functions', 'ts-function', 'ts-function.ts'),
            content: `
type CustomResponse = string;

export const handler = async function () {
  const response: CustomResponse = "ts";

  return {
    statusCode: 200,
    body: response,
  };
};

    `,
          })

          await builder.buildAsync()

          await withDevServer({ cwd: builder.directory, args }, async (server) => {
            const response = await got(`${server.url}/.netlify/functions/ts-function`).text()
            t.is(response, 'ts')
          })
        })
      },
    )

    test(testName(`should start https server when https dev block is configured`, args), async (t) => {
      await withSiteBuilder('sites-with-https-certificate', async (builder) => {
        await builder
          .withNetlifyToml({
            config: {
              build: { publish: 'public' },
              functions: { directory: 'functions' },
              dev: { https: { certFile: 'cert.pem', keyFile: 'key.pem' } },
            },
          })
          .withContentFile({
            path: 'public/index.html',
            content: 'index',
          })
          .withRedirectsFile({
            redirects: [{ from: `/api/*`, to: `/.netlify/functions/:splat`, status: '200' }],
          })
          .withFunction({
            path: 'hello.js',
            handler: async () => ({
              statusCode: 200,
              body: 'Hello World',
            }),
          })
          .buildAsync()

        await Promise.all([
          copyFileAsync(`${__dirname}/assets/cert.pem`, `${builder.directory}/cert.pem`),
          copyFileAsync(`${__dirname}/assets/key.pem`, `${builder.directory}/key.pem`),
        ])
        await withDevServer({ cwd: builder.directory, args }, async ({ port }) => {
          const options = { https: { rejectUnauthorized: false } }
          t.is(await got(`https://localhost:${port}`, options).text(), 'index')
          t.is(await got(`https://localhost:${port}/api/hello`, options).text(), 'Hello World')
        })
      })
    })

    test(testName(`should use custom functions timeouts`, args), async (t) => {
      await withSiteBuilder('site-with-custom-functions-timeout', async (builder) => {
        await builder
          .withNetlifyToml({
            config: {
              build: { publish: 'public' },
              functions: { directory: 'functions' },
            },
          })
          .withFunction({
            path: 'hello.js',
            handler: async () => {
              await new Promise((resolve) => {
                const SLEEP_TIME = 2000
                setTimeout(resolve, SLEEP_TIME)
              })
              return {
                statusCode: 200,
                body: 'Hello World',
              }
            },
          })
          .buildAsync()

        const siteInfo = {
          account_slug: 'test-account',
          id: 'site_id',
          name: 'site-name',
          functions_config: { timeout: 1 },
        }

        const routes = [
          { path: 'sites/site_id', response: siteInfo },

          { path: 'sites/site_id/service-instances', response: [] },
          {
            path: 'accounts',
            response: [{ slug: siteInfo.account_slug }],
          },
        ]

        await withMockApi(routes, async ({ apiUrl }) => {
          await withDevServer(
            {
              cwd: builder.directory,
              // we need to pass a token so the CLI tries to retrieve site information from the mock API
              args: [...args, '--auth', 'fake-token'],
              env: {
                NETLIFY_API_URL: apiUrl,
                NETLIFY_SITE_ID: 'site_id',
              },
            },
            async ({ url }) => {
              const error = await t.throwsAsync(() => got(`${url}/.netlify/functions/hello`))
              t.true(error.response.body.includes('TimeoutError: Task timed out after 1.00 seconds'))
            },
          )
        })
      })
    })
  }
})
/* eslint-enable require-await */
