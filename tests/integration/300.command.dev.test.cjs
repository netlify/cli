// Handlers are meant to be async outside tests
/* eslint-disable require-await */
const path = require('path')
const process = require('process')

// eslint-disable-next-line ava/use-test
const avaTest = require('ava')
const { isCI } = require('ci-info')

const { withDevServer } = require('./utils/dev-server.cjs')
const got = require('./utils/got.cjs')
const { withSiteBuilder } = require('./utils/site-builder.cjs')

const test = isCI ? avaTest.serial.bind(avaTest) : avaTest

test('should return index file when / is accessed', async (t) => {
  await withSiteBuilder('site-with-index-file', async (builder) => {
    builder.withContentFile({
      path: 'index.html',
      content: '<h1>⊂◉‿◉つ</h1>',
    })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(server.url).text()
      t.is(response, '<h1>⊂◉‿◉つ</h1>')
    })
  })
})

test('should return user defined headers when / is accessed', async (t) => {
  await withSiteBuilder('site-with-headers-on-root', async (builder) => {
    builder.withContentFile({
      path: 'index.html',
      content: '<h1>⊂◉‿◉つ</h1>',
    })

    const headerName = 'X-Frame-Options'
    const headerValue = 'SAMEORIGIN'
    builder.withHeadersFile({ headers: [{ path: '/*', headers: [`${headerName}: ${headerValue}`] }] })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const { headers } = await got(server.url)
      t.is(headers[headerName.toLowerCase()], headerValue)
    })
  })
})

test('should return user defined headers when non-root path is accessed', async (t) => {
  await withSiteBuilder('site-with-headers-on-non-root', async (builder) => {
    builder.withContentFile({
      path: 'foo/index.html',
      content: '<h1>⊂◉‿◉つ</h1>',
    })

    const headerName = 'X-Frame-Options'
    const headerValue = 'SAMEORIGIN'
    builder.withHeadersFile({ headers: [{ path: '/*', headers: [`${headerName}: ${headerValue}`] }] })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const { headers } = await got(`${server.url}/foo`)
      t.is(headers[headerName.toLowerCase()], headerValue)
    })
  })
})

test('should return response from a function with setTimeout', async (t) => {
  await withSiteBuilder('site-with-set-timeout-function', async (builder) => {
    builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
      path: 'timeout.js',
      handler: async () => {
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

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/.netlify/functions/timeout`).text()
      t.is(response, 'ping')
      const builderResponse = await got(`${server.url}/.netlify/builders/timeout`).text()
      t.is(builderResponse, 'ping')
    })
  })
})

test('should fail when no metadata is set for builder function', async (t) => {
  await withSiteBuilder('site-with-misconfigured-builder-function', async (builder) => {
    builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
      path: 'builder.js',
      handler: async () => ({
        statusCode: 200,
        body: 'ping',
      }),
    })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/.netlify/functions/builder`)
      t.is(response.body, 'ping')
      t.is(response.statusCode, 200)
      const builderResponse = await got(`${server.url}/.netlify/builders/builder`, {
        throwHttpErrors: false,
      })
      t.is(
        builderResponse.body,
        `{"message":"Function is not an on-demand builder. See https://ntl.fyi/create-builder for how to convert a function to a builder."}`,
      )
      t.is(builderResponse.statusCode, 400)
    })
  })
})

test('should serve function from a subdirectory', async (t) => {
  await withSiteBuilder('site-with-from-subdirectory', async (builder) => {
    builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
      path: path.join('echo', 'echo.js'),
      handler: async (event) => ({
        statusCode: 200,
        body: JSON.stringify({ rawUrl: event.rawUrl }),
        metadata: { builder_function: true },
      }),
    })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/.netlify/functions/echo`).json()
      t.deepEqual(response, { rawUrl: `${server.url}/.netlify/functions/echo` })
      const builderResponse = await got(`${server.url}/.netlify/builders/echo`).json()
      t.deepEqual(builderResponse, { rawUrl: `${server.url}/.netlify/builders/echo` })
    })
  })
})

test('should pass .env.development vars to function', async (t) => {
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

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/.netlify/functions/env`).text()
      t.is(response, 'FROM_DEV_FILE')
      const builderResponse = await got(`${server.url}/.netlify/builders/env`).text()
      t.is(builderResponse, 'FROM_DEV_FILE')
    })
  })
})

test('should pass process env vars to function', async (t) => {
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

    await withDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' } }, async (server) => {
      const response = await got(`${server.url}/.netlify/functions/env`).text()
      t.is(response, 'FROM_PROCESS_ENV')
      const builderResponse = await got(`${server.url}/.netlify/builders/env`).text()
      t.is(builderResponse, 'FROM_PROCESS_ENV')
    })
  })
})

test('should pass [build.environment] env vars to function', async (t) => {
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

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/.netlify/functions/env`).text()
      t.is(response, 'FROM_CONFIG_FILE')
      const builderResponse = await got(`${server.url}/.netlify/builders/env`).text()
      t.is(builderResponse, 'FROM_CONFIG_FILE')
    })
  })
})

test('[context.dev.environment] should override [build.environment]', async (t) => {
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

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/.netlify/functions/env`).text()
      t.is(response, 'DEV_CONTEXT')
    })
  })
})

test('should inject env vars based on [dev].envFiles file order', async (t) => {
  await withSiteBuilder('site-with-env-files', async (builder) => {
    builder
      .withNetlifyToml({
        config: {
          dev: { envFiles: ['.env.production', '.env.development', '.env'] },
          functions: { directory: 'functions' },
        },
      })
      .withEnvFile({ path: '.env.production', env: { TEST: 'FROM_PRODUCTION_FILE' } })
      .withEnvFile({
        path: '.env.development',
        env: { TEST: 'FROM_DEVELOPMENT_FILE', TEST2: 'FROM_DEVELOPMENT_FILE' },
      })
      .withEnvFile({ path: '.env', env: { TEST: 'FROM_DEFAULT_FILE', TEST2: 'FROM_DEFAULT_FILE' } })
      .withFunction({
        path: 'env.js',
        handler: async () => ({
          statusCode: 200,
          body: `${process.env.TEST}__${process.env.TEST2}`,
        }),
      })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/.netlify/functions/env`).text()
      t.is(response, 'FROM_PRODUCTION_FILE__FROM_DEVELOPMENT_FILE')
      t.true(server.output.includes('Ignored .env.development file'))
      t.true(server.output.includes('Ignored .env file'))
    })
  })
})
/* eslint-enable require-await */
