// Handlers are meant to be async outside tests
import { version } from 'process'

import FormData from 'form-data'
import { gte } from 'semver'
import { describe, test } from 'vitest'

import { withDevServer } from './utils/dev-server.cjs'
import got from './utils/got.cjs'
import { pause } from './utils/pause.cjs'
import { withSiteBuilder } from './utils/site-builder.cjs'

// FIXME: run tests serial
// const test = isCI ? avaTest.serial.bind(avaTest) : avaTest
describe.concurrent('400.command.dev', () => {
  test('should use [build.environment] and not [context.production.environment]', async (t) => {
    await withSiteBuilder('site-with-build-environment', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { environment: { NETLIFY_ENV_TEST: 'DEFAULT_CONTEXT' } },
            context: { production: { environment: { NETLIFY_ENV_TEST: 'PRODUCTION_CONTEXT' } } },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'env.js',
          handler: async () => ({ statusCode: 200, body: `${process.env.NETLIFY_ENV_TEST}` }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        t.expect(response).toEqual('DEFAULT_CONTEXT')
      })
    })
  })

  test('should use [context.production.environment] when --context=production', async (t) => {
    await withSiteBuilder('site-with-build-environment', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { environment: { NETLIFY_ENV_TEST: 'DEFAULT_CONTEXT' } },
            context: { production: { environment: { NETLIFY_ENV_TEST: 'PRODUCTION_CONTEXT' } } },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'env.js',
          handler: async () => ({
              statusCode: 200,
              body: `${process.env.NETLIFY_ENV_TEST}`,
            }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, context: 'production' }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        t.expect(response).toEqual('PRODUCTION_CONTEXT')
      })
    })
  })

  test('should override .env.development with process env', async (t) => {
    await withSiteBuilder('site-with-override', async (builder) => {
      builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withEnvFile({ path: '.env.development', env: { NETLIFY_ENV_TEST: 'FROM_DEV_FILE' } })
        .withFunction({
          path: 'env.js',
          handler: async () => ({
            statusCode: 200,
            body: `${process.env.NETLIFY_ENV_TEST}`,
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, env: { NETLIFY_ENV_TEST: 'FROM_PROCESS_ENV' } }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        t.expect(response).toEqual('FROM_PROCESS_ENV')
      })
    })
  })

  test('should override [build.environment] with process env', async (t) => {
    await withSiteBuilder('site-with-build-environment-override', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { environment: { NETLIFY_ENV_TEST: 'FROM_CONFIG_FILE' } },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'env.js',
          handler: async () => ({ statusCode: 200, body: `${process.env.NETLIFY_ENV_TEST}` }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, env: { NETLIFY_ENV_TEST: 'FROM_PROCESS_ENV' } }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        t.expect(response).toEqual('FROM_PROCESS_ENV')
      })
    })
  })

  test('should replicate Lambda behaviour for synchronous return values', async (t) => {
    await withSiteBuilder('site-replicate-aws-sync-behaviour', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: () => ({
          statusCode: 200,
        }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`, {
          throwHttpErrors: false,
          retry: {
            limit: 0,
          },
        })

        t.expect(response.statusCode).toBe(500)
        t.expect(response.body.startsWith('no lambda response.')).toBe(true)
      })
    })
  })

  test('should override value of the NETLIFY_DEV env variable', async (t) => {
    await withSiteBuilder('site-with-netlify-dev-override', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: async () => ({
          statusCode: 200,
          body: `${process.env.NETLIFY_DEV}`,
        }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, env: { NETLIFY_DEV: 'FROM_PROCESS_ENV' } }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        t.expect(response).toEqual('true')
      })
    })
  })

  test('should set value of the CONTEXT env variable', async (t) => {
    await withSiteBuilder('site-with-context-override', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: async () => ({
          statusCode: 200,
          body: `${process.env.CONTEXT}`,
        }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        t.expect(response).toEqual('dev')
      })
    })
  })

  test('should set value of the CONTEXT env variable to the --context flag', async (t) => {
    await withSiteBuilder('site-with-context-override', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: async () => ({
          statusCode: 200,
          body: `${process.env.CONTEXT}`,
        }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, context: 'deploy-preview' }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/env`).text()
        t.expect(response).toEqual('deploy-preview')
      })
    })
  })

  test('should redirect using a wildcard when set in netlify.toml', async (t) => {
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

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got(`${server.url}/api/ping`).text()
        t.expect(response).toEqual('ping')
      })
    })
  })

  test('should pass undefined body to functions event for GET requests when redirecting', async (t) => {
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

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got(`${server.url}/api/echo?ding=dong`).json()
        t.expect(response.body).toBe(undefined)
        t.expect(response.headers.host).toEqual(`${server.host}:${server.port}`)
        t.expect(response.httpMethod).toEqual('GET')
        t.expect(response.isBase64Encoded).toBe(true)
        t.expect(response.path).toEqual('/api/echo')
        t.expect(response.queryStringParameters).toStrictEqual({ ding: 'dong' })
      })
    })
  })

  test('should pass body to functions event for POST requests when redirecting', async (t) => {
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

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got
          .post(`${server.url}/api/echo?ding=dong`, {
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: 'some=thing',
          })
          .json()

        t.expect(response.body).toEqual('some=thing')
        t.expect(response.headers.host).toEqual(`${server.host}:${server.port}`)
        t.expect(response.headers['content-type']).toEqual('application/x-www-form-urlencoded')
        t.expect(response.headers['content-length']).toEqual('10')
        t.expect(response.httpMethod).toEqual('POST')
        t.expect(response.isBase64Encoded).toBe(false)
        t.expect(response.path).toEqual('/api/echo')
        t.expect(response.queryStringParameters).toStrictEqual({ ding: 'dong' })
      })
    })
  })

  test('should pass body to functions event for POST requests with passthrough edge function', async (t) => {
    await withSiteBuilder('site-with-post-echo-function', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
            edge_functions: [
              {
                function: 'passthrough',
                path: '/*',
              },
            ],
          },
        })
        .withEdgeFunction({
          name: 'passthrough',
          handler: async (_, context) => context.next(),
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got
          .post(`${server.url}/api/echo?ding=dong`, {
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: 'some=thing',
          })
          .json()

        t.expect(response.body).toEqual('some=thing')
        t.expect(response.headers.host).toEqual(`${server.host}:${server.port}`)
        t.expect(response.headers['content-type']).toEqual('application/x-www-form-urlencoded')
        t.expect(response.headers['transfer-encoding']).toEqual('chunked')
        t.expect(response.httpMethod).toEqual('POST')
        t.expect(response.isBase64Encoded).toBe(false)
        t.expect(response.path).toEqual('/api/echo')
        t.expect(response.queryStringParameters).toStrictEqual({ ding: 'dong' })
      })
    })
  })

  test('should return an empty body for a function with no body when redirecting', async (t) => {
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

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got.post(`${server.url}/api/echo?ding=dong`, {
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: 'some=thing',
        })

        t.expect(response.body).toEqual('')
        t.expect(response.statusCode).toBe(200)
      })
    })
  })

  test('should handle multipart form data when redirecting', async (t) => {
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

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const form = new FormData()
        form.append('some', 'thing')

        const expectedBoundary = form.getBoundary()
        const expectedResponseBody = form.getBuffer().toString('base64')

        const response = await got
          .post(`${server.url}/api/echo?ding=dong`, {
            body: form,
          })
          .json()

        t.expect(response.headers.host).toEqual(`${server.host}:${server.port}`)
        t.expect(response.headers['content-type']).toEqual(`multipart/form-data; boundary=${expectedBoundary}`)
        t.expect(response.headers['content-length']).toEqual('164')
        t.expect(response.httpMethod).toEqual('POST')
        t.expect(response.isBase64Encoded).toBe(true)
        t.expect(response.path).toEqual('/api/echo')
        t.expect(response.queryStringParameters).toStrictEqual({ ding: 'dong' })
        t.expect(response.body).toEqual(expectedResponseBody)
      })
    })
  })

  test.runIf(gte(version, '18.0.0'))('should support functions with streaming responses', async (t) => {
    await withSiteBuilder('site-with-streaming-function', async (builder) => {
      builder
        .withPackageJson({ packageJson: { dependencies: { '@netlify/functions': 'latest' } } })
        .withCommand({ command: ['npm', 'install'] })
        .withContentFile({
          content: `
          const { stream } = require("@netlify/functions");

          class TimerSource {
            #input;
            #interval;

            constructor(input) {
              this.#input = input;
            }

            start(controller) {
              this.#interval = setInterval(() => {
                const string = this.#input.shift();

                if (string === undefined) {
                  controller.close();

                  clearInterval(this.#interval);

                  return;
                }

                controller.enqueue(string);
              }, 50);
            }

            cancel() {
              clearInterval(this.#interval);
            }
          }

          exports.handler = stream(async (event) => ({
            body: new ReadableStream(new TimerSource(["one", "two", "three"])),
            headers: {
              "x-custom-header-1": "value 1"
            },
            statusCode: 200,
          }));
      `,
          path: 'netlify/functions/streamer.js',
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const chunks = []
        const response = got.stream(`${server.url}/.netlify/functions/streamer`)

        let lastTimestamp = 0

        response.on('data', (chunk) => {
          const now = Date.now()

          t.expect(now > lastTimestamp).toBe(true)

          lastTimestamp = now
          chunks.push(chunk.toString())
        })

        await pause(500)

        t.expect(chunks).toStrictEqual(['one', 'two', 'three'])
      })
    })
  })
})
