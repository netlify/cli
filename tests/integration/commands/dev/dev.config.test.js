// Handlers are meant to be async outside tests
import { version } from 'process'

import FormData from 'form-data'
import fetch from 'node-fetch'
import { gte } from 'semver'
import { describe, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.ts'
import { withSiteBuilder } from '../../utils/site-builder.ts'

describe.concurrent('commands/dev/config', () => {
  test('should use [build.environment] and not [context.production.environment]', async (t) => {
    await withSiteBuilder('site-with-build-environment', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { environment: { TEST_BUILD_ENVIRONMENT: 'DEFAULT_CONTEXT' } },
            context: { production: { environment: { TEST_BUILD_ENVIRONMENT: 'PRODUCTION_CONTEXT' } } },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'env.js',
          handler: async () => ({
            statusCode: 200,
            // eslint-disable-next-line n/prefer-global/process
            body: `${process.env.TEST_BUILD_ENVIRONMENT}`,
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('DEFAULT_CONTEXT')
      })
    })
  })

  test('should use [context.production.environment] when --context=production', async (t) => {
    await withSiteBuilder('site-with-build-environment', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { environment: { TEST_PRODUCTION_ENVIRONMENT: 'DEFAULT_CONTEXT' } },
            context: { production: { environment: { TEST_PRODUCTION_ENVIRONMENT: 'PRODUCTION_CONTEXT' } } },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'env.js',
          // eslint-disable-next-line n/prefer-global/process
          handler: async () => ({ statusCode: 200, body: `${process.env.TEST_PRODUCTION_ENVIRONMENT}` }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, context: 'production' }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('PRODUCTION_CONTEXT')
      })
    })
  })

  test('should override .env.development with process env', async (t) => {
    await withSiteBuilder('site-with-override', async (builder) => {
      builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withEnvFile({ path: '.env.development', env: { TEST: 'FROM_DEV_FILE' } })
        .withFunction({
          path: 'env.js',
          // eslint-disable-next-line n/prefer-global/process
          handler: async () => ({ statusCode: 200, body: `${process.env.TEST}` }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' } }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('FROM_PROCESS_ENV')
      })
    })
  })

  test('should override [build.environment] with process env', async (t) => {
    await withSiteBuilder('site-with-build-environment-override', async (builder) => {
      builder
        .withNetlifyToml({
          config: { build: { environment: { TEST: 'FROM_CONFIG_FILE' } }, functions: { directory: 'functions' } },
        })
        .withFunction({
          path: 'env.js',
          // eslint-disable-next-line n/prefer-global/process
          handler: async () => ({ statusCode: 200, body: `${process.env.TEST}` }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' } }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
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
        const response = await fetch(`${server.url}/.netlify/functions/env`)
        const resposeBody = await response.text()

        t.expect(response.status).toBe(500)
        t.expect(resposeBody.startsWith('no lambda response.')).toBe(true)
      })
    })
  })

  test('should override value of the NETLIFY_DEV env variable', async (t) => {
    await withSiteBuilder('site-with-netlify-dev-override', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        // eslint-disable-next-line n/prefer-global/process
        handler: async () => ({ statusCode: 200, body: `${process.env.NETLIFY_DEV}` }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, env: { NETLIFY_DEV: 'FROM_PROCESS_ENV' } }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('true')
      })
    })
  })

  test('should provide CLI version in env var', async (t) => {
    await withSiteBuilder('site-with-netlify-version-env-var', async (builder) => {
      await builder
        .withNetlifyToml({
          config: { dev: { command: `node -e console.log(process.env); setTimeout(undefined, 100)` } },
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        await server.close()
        t.expect(server.output).toContain('NETLIFY_CLI_VERSION')
      })
    })
  })

  test('should set value of the CONTEXT env variable', async (t) => {
    await withSiteBuilder('site-with-context-override', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        // eslint-disable-next-line n/prefer-global/process
        handler: async () => ({ statusCode: 200, body: `${process.env.CONTEXT}` }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('dev')
      })
    })
  })

  test('should set value of the CONTEXT env variable to the --context flag', async (t) => {
    await withSiteBuilder('site-with-context-override', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        // eslint-disable-next-line n/prefer-global/process
        handler: async () => ({ statusCode: 200, body: `${process.env.CONTEXT}` }),
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, context: 'deploy-preview' }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
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
        const response = await fetch(`${server.url}/api/ping`).then((res) => res.text())
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
        const response = await fetch(`${server.url}/api/echo?ding=dong`).then((res) => res.json())
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
        const response = await fetch(`${server.url}/api/echo?ding=dong`, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: 'some=thing',
        }).then((res) => res.json())

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
        const response = await fetch(`${server.url}/api/echo?ding=dong`, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: 'some=thing',
        }).then((res) => res.json())

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
        const response = await fetch(`${server.url}/api/echo?ding=dong`, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: 'some=thing',
        })

        t.expect(await response.text()).toEqual('')
        t.expect(response.status).toBe(200)
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

        const response = await fetch(`${server.url}/api/echo?ding=dong`, {
          method: 'POST',
          body: form,
        }).then((res) => res.json())

        t.expect(response.headers.host).toEqual(`${server.host}:${server.port}`)
        t.expect(response.headers['content-type']).toEqual(`multipart/form-data;boundary=${expectedBoundary}`)
        t.expect(response.headers['content-length']).toEqual('164')
        t.expect(response.httpMethod).toEqual('POST')
        t.expect(response.isBase64Encoded).toBe(true)
        t.expect(response.path).toEqual('/api/echo')
        t.expect(response.queryStringParameters).toStrictEqual({ ding: 'dong' })
        t.expect(response.body).toEqual(expectedResponseBody)
      })
    })
  })

  test.runIf(gte(version, '18.14.0'))('should support functions with streaming responses', async (t) => {
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

        // eslint-disable-next-line no-async-promise-executor
        await new Promise(async (resolve, reject) => {
          const stream = await fetch(`${server.url}/.netlify/functions/streamer`).then((res) => res.body)

          let lastTimestamp = 0

          stream.on('data', (chunk) => {
            const now = Date.now()

            t.expect(now > lastTimestamp).toBe(true)

            lastTimestamp = now
            chunks.push(chunk.toString())
          })

          stream.on('end', resolve)
          stream.on('error', reject)
        })

        t.expect(chunks).toStrictEqual(['one', 'two', 'three'])
      })
    })
  })
})
