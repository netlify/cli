// Handlers are meant to be async outside tests
import path from 'path'

import fetch from 'node-fetch'
import { describe, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

describe.concurrent('commands/responses.dev', () => {
  test('should return index file when / is accessed', async (t) => {
    await withSiteBuilder('site-with-index-file', async (builder) => {
      builder.withContentFile({
        path: 'index.html',
        content: '<h1>⊂◉‿◉つ</h1>',
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(server.url).then((res) => res.text())
        t.expect(response).toEqual('<h1>⊂◉‿◉つ</h1>')
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
        const { headers } = await fetch(server.url)
        t.expect(headers.get(headerName.toLowerCase())).toEqual(headerValue)
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
        const { headers } = await fetch(`${server.url}/foo`)
        t.expect(headers.get(headerName.toLowerCase())).toEqual(headerValue)
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
        const [response, builderResponse] = await Promise.all([
          fetch(`${server.url}/.netlify/functions/timeout`).then((res) => res.text()),
          fetch(`${server.url}/.netlify/builders/timeout`).then((res) => res.text()),
        ])

        t.expect(response).toEqual('ping')
        t.expect(builderResponse).toEqual('ping')
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
        const [response, builderResponse] = await Promise.all([
          fetch(`${server.url}/.netlify/functions/builder`),
          fetch(`${server.url}/.netlify/builders/builder`),
        ])
        t.expect(await response.text()).toEqual('ping')
        t.expect(response.status).toBe(200)

        t.expect(await builderResponse.text()).toEqual(
          `{"message":"Function is not an on-demand builder. See https://ntl.fyi/create-builder for how to convert a function to a builder."}`,
        )
        t.expect(builderResponse.status).toBe(400)
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
        const [response, builderResponse] = await Promise.all([
          fetch(`${server.url}/.netlify/functions/echo`).then((res) => res.json()),
          fetch(`${server.url}/.netlify/builders/echo`).then((res) => res.json()),
        ])
        t.expect(response).toStrictEqual({ rawUrl: `${server.url}/.netlify/functions/echo` })
        t.expect(builderResponse).toStrictEqual({ rawUrl: `${server.url}/.netlify/builders/echo` })
      })
    })
  })

  test('should pass .env.development vars to function', async (t) => {
    await withSiteBuilder('site-with-env-development', async (builder) => {
      builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withEnvFile({ path: '.env.development', env: { ENV_DEV_TEST: 'FROM_DEV_FILE' } })
        .withFunction({
          path: 'env.js',
          handler: async () => ({
            statusCode: 200,
            // eslint-disable-next-line n/prefer-global/process
            body: `${process.env.ENV_DEV_TEST}`,
            metadata: { builder_function: true },
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const [response, builderResponse] = await Promise.all([
          fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text()),
          fetch(`${server.url}/.netlify/builders/env`).then((res) => res.text()),
        ])

        t.expect(response).toEqual('FROM_DEV_FILE')
        t.expect(builderResponse).toEqual('FROM_DEV_FILE')
      })
    })
  })

  test('should pass process env vars to function', async (t) => {
    await withSiteBuilder('site-with-process-env', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: async () => ({
          statusCode: 200,
          // eslint-disable-next-line n/prefer-global/process
          body: `${process.env.TEST}`,
          metadata: { builder_function: true },
        }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' } }, async (server) => {
        const [response, builderResponse] = await Promise.all([
          fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text()),
          fetch(`${server.url}/.netlify/builders/env`).then((res) => res.text()),
        ])

        t.expect(response).toEqual('FROM_PROCESS_ENV')
        t.expect(builderResponse).toEqual('FROM_PROCESS_ENV')
      })
    })
  })

  test('should pass [build.environment] env vars to function', async (t) => {
    await withSiteBuilder('site-with-build-environment', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { environment: { BUILD_ENV_TEST: 'FROM_CONFIG_FILE' } },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'env.js',
          handler: async () => ({
            statusCode: 200,
            // eslint-disable-next-line n/prefer-global/process
            body: `${process.env.BUILD_ENV_TEST}`,
            metadata: { builder_function: true },
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const [response, builderResponse] = await Promise.all([
          fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text()),
          fetch(`${server.url}/.netlify/builders/env`).then((res) => res.text()),
        ])
        t.expect(response).toEqual('FROM_CONFIG_FILE')
        t.expect(builderResponse).toEqual('FROM_CONFIG_FILE')
      })
    })
  })

  test('[context.dev.environment] should override [build.environment]', async (t) => {
    await withSiteBuilder('site-with-build-environment', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { environment: { CONTEXT_TEST: 'DEFAULT_CONTEXT' } },
            context: { dev: { environment: { CONTEXT_TEST: 'DEV_CONTEXT' } } },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'env.js',
          handler: async () => ({
            statusCode: 200,
            // eslint-disable-next-line n/prefer-global/process
            body: `${process.env.CONTEXT_TEST}`,
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('DEV_CONTEXT')
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
        .withEnvFile({ path: '.env.production', env: { TEST_1: 'FROM_PRODUCTION_FILE' } })
        .withEnvFile({
          path: '.env.development',
          env: { TEST_1: 'FROM_DEVELOPMENT_FILE', TEST2: 'FROM_DEVELOPMENT_FILE' },
        })
        .withEnvFile({ path: '.env', env: { TEST_1: 'FROM_DEFAULT_FILE', TEST2: 'FROM_DEFAULT_FILE' } })
        .withFunction({
          path: 'env.js',
          handler: async () => ({
            statusCode: 200,
            // eslint-disable-next-line n/prefer-global/process
            body: `${process.env.TEST_1}__${process.env.TEST2}`,
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('FROM_PRODUCTION_FILE__FROM_DEVELOPMENT_FILE')
        t.expect(server.output.includes('Ignored .env.development file')).toBe(true)
        t.expect(server.output.includes('Ignored .env file')).toBe(true)
      })
    })
  })
})
