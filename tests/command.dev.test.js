// Handlers are meant to be async outside tests
/* eslint-disable require-await */
const { copyFile } = require('fs').promises
const http = require('http')
const os = require('os')
const path = require('path')
const process = require('process')

const dotProp = require('dot-prop')
const FormData = require('form-data')
const jwt = require('jsonwebtoken')

const { curl } = require('./utils/curl')
const { withDevServer } = require('./utils/dev-server')
const { startExternalServer } = require('./utils/external-server')
const got = require('./utils/got')
const { withMockApi } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')

const testMatrix = [
  { args: [] },

  // some tests are still failing with this enabled
  // { args: ['--edgeHandlers'] }
]

const testName = (title, args) => (args.length <= 0 ? title : `${title} - ${args.join(' ')}`)

const JWT_EXPIRY = 1_893_456_000
const getToken = ({ jwtRolePath = 'app_metadata.authorization.roles', jwtSecret = 'secret', roles }) => {
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

const validateRoleBasedRedirectsSite = async ({ args, builder, jwtRolePath, jwtSecret }) => {
  const adminToken = getToken({ jwtSecret, jwtRolePath, roles: ['admin'] })
  const editorToken = getToken({ jwtSecret, jwtRolePath, roles: ['editor'] })

  await withDevServer({ cwd: builder.directory, args }, async (server) => {
    const unauthenticatedResponse = await got(`${server.url}/admin`, { throwHttpErrors: false })
    expect(unauthenticatedResponse.statusCode).toBe(404)
    expect(unauthenticatedResponse.body).toBe('Not Found')

    const authenticatedResponse = await got(`${server.url}/admin/foo`, {
      headers: {
        cookie: `nf_jwt=${adminToken}`,
      },
    })
    expect(authenticatedResponse.statusCode).toBe(200)
    expect(authenticatedResponse.body).toBe('<html>foo</html>')

    const wrongRoleResponse = await got(`${server.url}/admin/foo`, {
      headers: {
        cookie: `nf_jwt=${editorToken}`,
      },
      throwHttpErrors: false,
    })
    expect(wrongRoleResponse.statusCode).toBe(404)
    expect(wrongRoleResponse.body).toBe('Not Found')
  })
}

testMatrix.forEach(({ args }) => {
  test(testName('should return index file when / is accessed', args), async () => {
    await withSiteBuilder('site-with-index-file', async (builder) => {
      builder.withContentFile({
        path: 'index.html',
        content: '<h1>⊂◉‿◉つ</h1>',
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(server.url).text()
        expect(response).toBe('<h1>⊂◉‿◉つ</h1>')
      })
    })
  })

  test(testName('should return user defined headers when / is accessed', args), async () => {
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
        expect(headers[headerName.toLowerCase()]).toBe(headerValue)
      })
    })
  })

  test(testName('should return user defined headers when non-root path is accessed', args), async () => {
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
        expect(headers[headerName.toLowerCase()]).toBe(headerValue)
      })
    })
  })

  test(testName('should return response from a function with setTimeout', args), async () => {
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
            metadata: { builder_function: true },
          }
        },
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/timeout`).text()
        expect(response).toBe('ping')
        const builderResponse = await got(`${server.url}/.netlify/builders/timeout`).text()
        expect(builderResponse).toBe('ping')
      })
    })
  })

  test(testName('should fail when no metadata is set for builder function', args), async () => {
    await withSiteBuilder('site-with-misconfigured-builder-function', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'builder.js',
        handler: async () => ({
          statusCode: 200,
          body: 'ping',
        }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/builder`)
        expect(response.body).toBe('ping')
        expect(response.statusCode).toBe(200)
        const builderResponse = await got(`${server.url}/.netlify/builders/builder`, {
          throwHttpErrors: false,
        })
        expect(builderResponse.body).toBe(
          `{"message":"Function is not an on-demand builder. See https://ntl.fyi/create-builder for how to convert a function to a builder."}`,
        )
        expect(builderResponse.statusCode).toBe(400)
      })
    })
  })

  test(testName('should serve function from a subdirectory', args), async () => {
    await withSiteBuilder('site-with-from-subdirectory', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: path.join('echo', 'echo.js'),
        handler: async () => ({
          statusCode: 200,
          body: 'ping',
          metadata: { builder_function: true },
        }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/echo`).text()
        expect(response).toBe('ping')
        const builderResponse = await got(`${server.url}/.netlify/builders/echo`).text()
        expect(builderResponse).toBe('ping')
      })
    })
  })

  test(testName('should pass .env.development vars to function', args), async () => {
    await withSiteBuilder('site-with-env-development', async (builder) => {
      builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withEnvFile({ path: '.env.development', env: { TEST: 'FROM_DEV_FILE' } })
        .withFunction({
          path: 'env.js',
          handler: async () => ({
            statusCode: 200,
            body: `${process.env.TEST}`,
            metadata: { builder_function: true },
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        expect(response).toBe('FROM_DEV_FILE')
        const builderResponse = await got(`${server.url}/.netlify/builders/env`).text()
        expect(builderResponse).toBe('FROM_DEV_FILE')
      })
    })
  })

  test(testName('should pass process env vars to function', args), async () => {
    await withSiteBuilder('site-with-process-env', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: async () => ({
          statusCode: 200,
          body: `${process.env.TEST}`,
          metadata: { builder_function: true },
        }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' }, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        expect(response).toBe('FROM_PROCESS_ENV')
        const builderResponse = await got(`${server.url}/.netlify/builders/env`).text()
        expect(builderResponse).toBe('FROM_PROCESS_ENV')
      })
    })
  })

  test(testName('should pass [build.environment] env vars to function', args), async () => {
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
            metadata: { builder_function: true },
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        expect(response).toBe('FROM_CONFIG_FILE')
        const builderResponse = await got(`${server.url}/.netlify/builders/env`).text()
        expect(builderResponse).toBe('FROM_CONFIG_FILE')
      })
    })
  })

  test(testName('[context.dev.environment] should override [build.environment]', args), async () => {
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
        expect(response).toBe('DEV_CONTEXT')
      })
    })
  })

  test(testName('should use [build.environment] and not [context.production.environment]', args), async () => {
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
        expect(response).toBe('DEFAULT_CONTEXT')
      })
    })
  })

  test(testName('should override .env.development with process env', args), async () => {
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
        expect(response).toBe('FROM_PROCESS_ENV')
      })
    })
  })

  test(testName('should override [build.environment] with process env', args), async () => {
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
        expect(response).toBe('FROM_PROCESS_ENV')
      })
    })
  })

  test(testName('should override value of the NETLIFY_DEV env variable', args), async () => {
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
          expect(response).toBe('true')
        },
      )
    })
  })

  test(testName('should set value of the CONTEXT env variable', args), async () => {
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
        expect(response).toBe('dev')
      })
    })
  })

  test(testName('should redirect using a wildcard when set in netlify.toml', args), async () => {
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
        expect(response).toBe('ping')
      })
    })
  })

  test(testName('should pass undefined body to functions event for GET requests when redirecting', args), async () => {
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
        expect(response.body).toBe(undefined)
        expect(response.headers.host).toBe(`${server.host}:${server.port}`)
        expect(response.httpMethod).toBe('GET')
        expect(response.isBase64Encoded).toBe(true)
        expect(response.path).toBe('/api/echo')
        expect(response.queryStringParameters).toEqual({ ding: 'dong' })
      })
    })
  })

  test(testName('should pass body to functions event for POST requests when redirecting', args), async () => {
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

        expect(response.body).toBe('some=thing')
        expect(response.headers.host).toBe(`${server.host}:${server.port}`)
        expect(response.headers['content-type']).toBe('application/x-www-form-urlencoded')
        expect(response.headers['content-length']).toBe('10')
        expect(response.httpMethod).toBe('POST')
        expect(response.isBase64Encoded).toBe(false)
        expect(response.path).toBe('/api/echo')
        expect(response.queryStringParameters).toEqual({ ding: 'dong' })
      })
    })
  })

  test(testName('should return an empty body for a function with no body when redirecting', args), async () => {
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

        expect(response.body).toBe('')
        expect(response.statusCode).toBe(200)
      })
    })
  })

  test(testName('should handle multipart form data when redirecting', args), async () => {
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

        expect(response.headers.host).toBe(`${server.host}:${server.port}`)
        expect(response.headers['content-type']).toBe(`multipart/form-data; boundary=${expectedBoundary}`)
        expect(response.headers['content-length']).toBe('164')
        expect(response.httpMethod).toBe('POST')
        expect(response.isBase64Encoded).toBe(true)
        expect(response.path).toBe('/api/echo')
        expect(response.queryStringParameters).toEqual({ ding: 'dong' })
        expect(response.body).toBe(expectedResponseBody)
      })
    })
  })

  test(testName('should return 404 when redirecting to a non existing function', args), async () => {
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

        expect(response.statusCode).toBe(404)
      })
    })
  })

  test(testName('should parse function query parameters using simple parsing', args), async () => {
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

        expect(response1.queryStringParameters).toEqual({ 'category[SOMETHING][]': 'something' })
        expect(response2.queryStringParameters).toEqual({ category: 'one, two' })
      })
    })
  })

  test(testName('should handle form submission', args), async () => {
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

        expect(response.headers.host).toBe(`${server.host}:${server.port}`)
        expect(response.headers['content-length']).toBe('276')
        expect(response.headers['content-type']).toBe('application/json')
        expect(response.httpMethod).toBe('POST')
        expect(response.isBase64Encoded).toBe(false)
        expect(response.path).toBe('/')
        expect(response.queryStringParameters).toEqual({ ding: 'dong' })
        expect(body).toEqual({
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

  test(testName('should handle form submission with a background function', args), async () => {
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
        expect(response.statusCode).toBe(202)
        expect(response.body).toBe('')
      })
    })
  })

  test(testName('should not handle form submission when content type is `text/plain`', args), async () => {
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
        expect(response.body).toBe('Method Not Allowed')
      })
    })
  })

  test(testName('should return existing local file even when rewrite matches when force=false', args), async () => {
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
        expect(response).toBe('<html><h1>foo')
      })
    })
  })

  test(testName('should return existing local file even when redirect matches when force=false', args), async () => {
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
        expect(response).toBe('<html><h1>foo')
      })
    })
  })

  test(testName('should ignore existing local file when redirect matches and force=true', args), async () => {
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
        expect(response).toBe('<html><h1>not-foo')
      })
    })
  })

  test(testName('should use existing file when rule contains file extension and force=false', args), async () => {
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
        expect(response).toBe('<html><h1>foo')
      })
    })
  })

  test(testName('should redirect when rule contains file extension and force=true', args), async () => {
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
        expect(response).toBe('<html><h1>not-foo')
      })
    })
  })

  test(testName('should redirect from sub directory to root directory', args), async () => {
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

        expect(response1).toBe('<html><h1>foo')
        expect(response2).toBe('<html><h1>foo')
        expect(response3).toBe('<html><h1>not-foo')
      })
    })
  })

  test(testName('should return 404.html if exists for non existing routes', args), async () => {
    await withSiteBuilder('site-with-shadowing-404', async (builder) => {
      builder.withContentFile({
        path: '404.html',
        content: '<h1>404 - Page not found</h1>',
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/non-existent`, { throwHttpErrors: false })
        expect(response.body).toBe('<h1>404 - Page not found</h1>')
      })
    })
  })

  test(testName('should return 404.html from publish folder if exists for non existing routes', args), async () => {
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
        const response = await got(`${server.url}/non-existent`, { throwHttpErrors: false })
        expect(response.statusCode).toBe(404)
        expect(response.body).toBe('<h1>404 - My Custom 404 Page</h1>')
      })
    })
  })

  test(testName('should return 404 for redirect', args), async () => {
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
        const response = await got(`${server.url}/test-404`, { throwHttpErrors: false })
        expect(response.statusCode).toBe(404)
        expect(response.body).toBe('<html><h1>foo')
      })
    })
  })

  test(testName('should ignore 404 redirect for existing file', args), async () => {
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

        expect(response.statusCode).toBe(200)
        expect(response.body).toBe('<html><h1>This page actually exists')
      })
    })
  })

  test(testName('should follow 404 redirect even with existing file when force=true', args), async () => {
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
        const response = await got(`${server.url}/test-404`, { throwHttpErrors: false })

        expect(response.statusCode).toBe(404)
        expect(response.body).toBe('<html><h1>foo')
      })
    })
  })

  test(testName('should source redirects file from publish directory', args), async () => {
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

        expect(response.statusCode).toBe(200)
        expect(response.body).toBe('index')
      })
    })
  })

  test(testName('should redirect requests to an external server', args), async () => {
    await withSiteBuilder('site-redirects-file-to-external', async (builder) => {
      const externalServer = startExternalServer()
      const { port } = externalServer.address()
      builder.withRedirectsFile({
        redirects: [{ from: '/api/*', to: `http://localhost:${port}/:splat`, status: 200 }],
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const getResponse = await got(`${server.url}/api/ping`).json()
        expect(getResponse).toEqual({ body: {}, method: 'GET', url: '/ping' })

        const postResponse = await got
          .post(`${server.url}/api/ping`, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'param=value',
          })
          .json()
        expect(postResponse).toEqual({ body: { param: 'value' }, method: 'POST', url: '/ping' })
      })

      externalServer.close()
    })
  })

  test(testName('should redirect POST request if content-type is missing', args), async () => {
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
        expect(data).toBe('Method Not Allowed')
      })
    })
  })

  test(testName('should return .html file when file and folder have the same name', args), async () => {
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

        expect(response.statusCode).toBe(200)
        expect(response.body).toBe('<html><h1>foo')
      })
    })
  })

  test(testName('should not shadow an existing file that has unsafe URL characters', args), async () => {
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

        expect(spaces).toBe('<html>file with spaces</html>')
        expect(brackets).toBe('<html>file with brackets</html>')
      })
    })
  })

  test(testName('should follow redirect for fully qualified rule', args), async () => {
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

        expect(response.statusCode).toBe(200)
        expect(response.body).toBe('<html>hello</html>')
      })
    })
  })

  test(testName('should return 202 ok and empty response for background function', args), async () => {
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
        expect(response.statusCode).toBe(202)
        expect(response.body).toBe('')
      })
    })
  })

  test(testName('should enforce role based redirects with default secret and role path', args), async () => {
    await withSiteBuilder('site-with-default-role-based-redirects', async (builder) => {
      setupRoleBasedRedirectsSite(builder)
      await builder.buildAsync()
      await validateRoleBasedRedirectsSite({ builder, args })
    })
  })

  test(testName('should enforce role based redirects with custom secret and role path', args), async () => {
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
      await validateRoleBasedRedirectsSite({ builder, args, jwtSecret, jwtRolePath })
    })
  })

  test(testName('routing-local-proxy serves edge handlers with --edgeHandlers flag', args), async () => {
    await withSiteBuilder('site-with-fully-qualified-redirect-rule', async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_handlers: 'netlify/edge-handlers',
            },
            'edge-handlers': [
              {
                handler: 'smoke',
                path: '/edge-handler',
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

        expect(response.statusCode).toBe(301)
        expect(response.headers.location).toBe('https://google.com/')
      })
    })
  })

  test(testName('routing-local-proxy serves edge handlers with deprecated --trafficMesh flag', args), async () => {
    await withSiteBuilder('site-with-fully-qualified-redirect-rule', async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_handlers: 'netlify/edge-handlers',
            },
            'edge-handlers': [
              {
                handler: 'smoke',
                path: '/edge-handler',
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

        expect(response.statusCode).toBe(301)
        expect(response.headers.location).toBe('https://google.com/')
      })
    })
  })

  test(testName('routing-local-proxy builds projects w/o edge handlers', args), async () => {
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

        expect(response.statusCode).toBe(200)
      })
    })
  })

  test(testName('redirect with country cookie', args), async () => {
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
        expect(response.statusCode).toBe(200)
        expect(response.body).toBe('<html>index in spanish</html>')
      })
    })
  })

  test(testName(`doesn't hang when sending a application/json POST request to function server`, args), async () => {
    await withSiteBuilder('site-with-functions', async (builder) => {
      const functionsPort = 6666
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' }, dev: { functionsPort } } })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ port, url }) => {
        const response = await got(`${url.replace(port, functionsPort)}/test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: '{}',
          throwHttpErrors: false,
        })
        expect(response.statusCode).toBe(404)
        expect(response.body).toBe('Function not found...')
      })
    })
  })

  test(testName(`catches invalid function names`, args), async () => {
    await withSiteBuilder('site-with-functions', async (builder) => {
      const functionsPort = 6667
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' }, dev: { functionsPort } } })
        .withFunction({
          path: 'exclamat!on.js',
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ port, url }) => {
        const response = await got(`${url.replace(port, functionsPort)}/exclamat!on`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: '{}',
          throwHttpErrors: false,
        })
        expect(response.statusCode).toBe(400)
        expect(response.body).toBe(
          'Function name should consist only of alphanumeric characters, hyphen & underscores.',
        )
      })
    })
  })

  test(testName('should handle query params in redirects', args), async () => {
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
        expect(fromFunction.multiValueQueryStringParameters).toEqual({ foo: ['1', '2'], bar: ['1', '2'] })

        // query params should be passed through from the request
        expect(queryPassthrough.headers.location).toBe('/?foo=1&foo=2&bar=1&bar=2')

        // query params should be taken from the redirect rule
        expect(queryInRedirect.headers.location).toBe('/?a=1&a=2')

        // query params should be taken from the redirect rule
        expect(withParamMatching.headers.location).toBe('/?param=1')
      })
    })
  })

  test(testName('Should not use the ZISI function bundler if not using esbuild', args), async () => {
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

      try {
        await withDevServer({ cwd: builder.directory, args }, async (server) =>
          got(`${server.url}/.netlify/functions/esm-function`).text(),
        )
      } catch {
        // should throw
        expect(true).toBe(true)
      }
    })
    expect.assertions(1)
  })

  test(testName('Should use the ZISI function bundler and serve ESM functions if using esbuild', args), async () => {
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
        expect(response).toBe('esm')
      })
    })
  })

  test(
    testName('Should use the ZISI function bundler and serve TypeScript functions if using esbuild', args),
    async () => {
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
          expect(response).toBe('ts')
        })
      })
    },
  )

  test(
    testName('Should use the ZISI function bundler and serve TypeScript functions if not using esbuild', args),
    async () => {
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
          expect(response).toBe('ts')
        })
      })
    },
  )

  test(testName(`should start https server when https dev block is configured`, args), async () => {
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
        copyFile(`${__dirname}/assets/cert.pem`, `${builder.directory}/cert.pem`),
        copyFile(`${__dirname}/assets/key.pem`, `${builder.directory}/key.pem`),
      ])
      await withDevServer({ cwd: builder.directory, args }, async ({ port }) => {
        const options = { https: { rejectUnauthorized: false } }
        expect(await got(`https://localhost:${port}`, options).text()).toBe('index')
        expect(await got(`https://localhost:${port}/api/hello`, options).text()).toBe('Hello World')
      })
    })
  })

  test(testName(`should use custom functions timeouts`, args), async () => {
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
            offline: false,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_SITE_ID: 'site_id',
              NETLIFY_AUTH_TOKEN: 'fake-token',
            },
          },
          async ({ url }) => {
            try {
              await got(`${url}/.netlify/functions/hello`)
            } catch (error) {
              error.message.includes('TimeoutError: Task timed out after 1.00 seconds').toBe(true)
            }
          },
        )
      })
    })
    expect.assertions(1)
  })

  // we need curl to reproduce this issue
  if (os.platform() !== 'win32') {
    test(testName(`don't hang on 'Expect: 100-continue' header`, args), async () => {
      await withSiteBuilder('site-with-expect-header', async (builder) => {
        await builder
          .withNetlifyToml({
            config: {
              functions: { directory: 'functions' },
            },
          })
          .withFunction({
            path: 'hello.js',
            handler: async () => ({ statusCode: 200, body: 'Hello' }),
          })
          .buildAsync()

        await withDevServer({ cwd: builder.directory, args }, async (server) => {
          await curl(`${server.url}/.netlify/functions/hello`, [
            '-i',
            '-v',
            '-d',
            '{"somefield":"somevalue"}',
            '-H',
            'Content-Type: application/json',
            '-H',
            `Expect: 100-continue' header`,
          ])
        })
      })
    })
  }

  test(testName(`serves non ascii static files correctly`, args), async () => {
    await withSiteBuilder('site-with-non-ascii-files', async (builder) => {
      await builder
        .withContentFile({
          path: 'public/范.txt',
          content: 'success',
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            redirects: [{ from: '/*', to: '/index.html', status: 200 }],
          },
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/${encodeURIComponent('范.txt')}`)
        expect(response.body).toBe('success')
      })
    })
  })

  test(testName(`returns headers set by function`, args), async () => {
    await withSiteBuilder('site-with-function-with-custom-headers', async (builder) => {
      await builder
        .withFunction({
          pathPrefix: 'netlify/functions',
          path: 'custom-headers.js',
          handler: async () => ({
            statusCode: 200,
            body: '',
            headers: { 'single-value-header': 'custom-value' },
            multiValueHeaders: { 'multi-value-header': ['custom-value1', 'custom-value2'] },
            metadata: { builder_function: true },
          }),
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/custom-headers`)
        expect(response.headers['single-value-header']).toBe('custom-value')
        expect(response.headers['multi-value-header']).toBe('custom-value1, custom-value2')
        const builderResponse = await got(`${server.url}/.netlify/builders/custom-headers`)
        expect(builderResponse.headers['single-value-header']).toBe('custom-value')
        expect(builderResponse.headers['multi-value-header']).toBe('custom-value1, custom-value2')
      })
    })
  })

  test(testName('should match redirect when path is URL encoded', args), async () => {
    await withSiteBuilder('site-with-encoded-redirect', async (builder) => {
      await builder
        .withContentFile({ path: 'static/special[test].txt', content: `special` })
        .withRedirectsFile({ redirects: [{ from: '/_next/static/*', to: '/static/:splat', status: 200 }] })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const [response1, response2] = await Promise.all([
          got(`${server.url}/_next/static/special[test].txt`).text(),
          got(`${server.url}/_next/static/special%5Btest%5D.txt`).text(),
        ])
        expect(response1).toBe('special')
        expect(response2).toBe('special')
      })
    })
  })

  test(testName(`should not redirect POST request to functions server when it doesn't exists`, args), async () => {
    await withSiteBuilder('site-with-post-request', async (builder) => {
      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        // an error is expected since we're sending a POST request to a static server
        // the important thing is that it's not proxied to the functions server
        try {
          await got.post(`${server.url}/api/test`, {
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: 'some=thing',
          })
        } catch (error) {
          expect(error.message).toBe('Response code 405 (Method Not Allowed)')
        }
      })
    })
  })
  expect.assertions(1)
})
/* eslint-enable require-await */
