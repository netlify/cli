import { Buffer } from 'node:buffer'
import { version } from 'node:process'

import type { HandlerEvent } from '@netlify/functions'
import getPort from 'get-port'

import { gte } from 'semver'
import { describe, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

describe.concurrent('commands/dev/config', () => {
  test('should use [build.environment] and not [context.production.environment]', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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
          handler: async () =>
            Promise.resolve({
              statusCode: 200,
              body: process.env.TEST_BUILD_ENVIRONMENT ?? '',
            }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('DEFAULT_CONTEXT')
      })
    })
  })

  test('should use [context.production.environment] when --context=production', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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
          handler: async () => Promise.resolve({ statusCode: 200, body: process.env.TEST_PRODUCTION_ENVIRONMENT }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory, context: 'production' }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('PRODUCTION_CONTEXT')
      })
    })
  })

  test('should override .env.development with process env', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withEnvFile({ path: '.env.development', env: { TEST: 'FROM_DEV_FILE' } })
        .withFunction({
          path: 'env.js',
          handler: async () => Promise.resolve({ statusCode: 200, body: process.env.TEST }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' } }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('FROM_PROCESS_ENV')
      })
    })
  })

  test('should override [build.environment] with process env', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({
          config: { build: { environment: { TEST: 'FROM_CONFIG_FILE' } }, functions: { directory: 'functions' } },
        })
        .withFunction({
          path: 'env.js',
          handler: async () => Promise.resolve({ statusCode: 200, body: process.env.TEST }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' } }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('FROM_PROCESS_ENV')
      })
    })
  })

  test('should replicate Lambda behaviour for synchronous return values', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        // @ts-expect-error(ndhoule): Intentionally breaks type contract by returning synchronously
        handler: () => ({ statusCode: 200 }),
      })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`)
        const responseBody = await response.text()

        t.expect(response.status).toBe(500)
        t.expect(responseBody.startsWith('no lambda response.')).toBe(true)
      })
    })
  })

  test('should override value of the NETLIFY_DEV env variable', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: async () => Promise.resolve({ statusCode: 200, body: process.env.NETLIFY_DEV }),
      })

      await builder.build()

      await withDevServer({ cwd: builder.directory, env: { NETLIFY_DEV: 'FROM_PROCESS_ENV' } }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('true')
      })
    })
  })

  test('should provide environment variables to framework server', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const port = await getPort()

      await builder
        .withContentFile({
          content: `
          import http from "http";

          http.createServer((req, res) => {
            res.write(JSON.stringify({
              NETLIFY_BLOBS_CONTEXT: process.env.NETLIFY_BLOBS_CONTEXT,
              NETLIFY_CLI_VERSION: process.env.NETLIFY_CLI_VERSION,
            }))
            res.end()
          }).listen(${port.toString()});
          `,
          path: 'devserver.mjs',
        })
        .withNetlifyToml({
          config: {
            dev: {
              framework: '#custom',
              command: 'node devserver.mjs',
              targetPort: port,
            },
          },
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const resp = await fetch(server.url)
        // @ts-expect-error TS(2339) FIXME: Property 'NETLIFY_BLOBS_CONTEXT' does not exist on... Remove this comment to see the full error message
        const { NETLIFY_BLOBS_CONTEXT, NETLIFY_CLI_VERSION } = await resp.json()

        t.expect(NETLIFY_BLOBS_CONTEXT).toBeTypeOf('string')

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { deployID, edgeURL, siteID, token, uncachedEdgeURL } = JSON.parse(
          Buffer.from(NETLIFY_BLOBS_CONTEXT as string, 'base64').toString(),
        )

        t.expect(deployID).toBe('0')
        t.expect(edgeURL).toMatch(/^http:\/\/localhost:/)
        t.expect(uncachedEdgeURL).toMatch(/^http:\/\/localhost:/)
        t.expect(siteID).toBeTypeOf('string')
        t.expect(token).toBeTypeOf('string')

        t.expect(NETLIFY_CLI_VERSION).toMatch(/\d+\.\d+\.\d+/)
      })
    })
  })

  test('should set value of the CONTEXT env variable', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: async () => Promise.resolve({ statusCode: 200, body: process.env.CONTEXT }),
      })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('dev')
      })
    })
  })

  test('should set value of the CONTEXT env variable to the --context flag', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: async () => Promise.resolve({ statusCode: 200, body: process.env.CONTEXT }),
      })

      await builder.build()

      await withDevServer({ cwd: builder.directory, context: 'deploy-preview' }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('deploy-preview')
      })
    })
  })

  test('should redirect using a wildcard when set in netlify.toml', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'ping.js',
          handler: async () =>
            Promise.resolve({
              statusCode: 200,
              body: 'ping',
            }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/api/ping`).then((res) => res.text())
        t.expect(response).toEqual('ping')
      })
    })
  })

  test('should pass undefined body to functions event for GET requests when redirecting', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event: HandlerEvent) =>
            Promise.resolve({
              statusCode: 200,
              body: JSON.stringify(event),
            }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/api/echo?ding=dong`)
        const body = await response.json()
        t.expect(body).not.toHaveProperty('body')
        t.expect(body).toHaveProperty('headers.host', `${server.host}:${server.port.toString()}`)
        t.expect(body).toHaveProperty('httpMethod', 'GET')
        t.expect(body).toHaveProperty('isBase64Encoded', true)
        t.expect(body).toHaveProperty('path', '/api/echo')
        t.expect(body).toHaveProperty('queryStringParameters', { ding: 'dong' })
      })
    })
  })

  test('should pass body to functions event for POST requests when redirecting', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event: HandlerEvent) =>
            Promise.resolve({
              statusCode: 200,
              body: JSON.stringify(event),
            }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/api/echo?ding=dong`, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: 'some=thing',
        })
        const body = await response.json()

        t.expect(body).toHaveProperty('body', 'some=thing')
        t.expect(body).toHaveProperty('headers.host', `${server.host}:${server.port.toString()}`)
        t.expect(body).toHaveProperty('headers.content-type', 'application/x-www-form-urlencoded')
        t.expect(body).toHaveProperty('headers.content-length', '10')
        t.expect(body).toHaveProperty('httpMethod', 'POST')
        t.expect(body).toHaveProperty('isBase64Encoded', false)
        t.expect(body).toHaveProperty('path', '/api/echo')
        t.expect(body).toHaveProperty('queryStringParameters', { ding: 'dong' })
      })
    })
  })

  test('should pass body to functions event for POST requests with passthrough edge function', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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
          handler: async (event: HandlerEvent) =>
            Promise.resolve({
              statusCode: 200,
              body: JSON.stringify(event),
            }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/api/echo?ding=dong`, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: 'some=thing',
        })
        const body = await response.json()

        console.log(body)
        t.expect(body).toHaveProperty('body', 'some=thing')
        t.expect(body).toHaveProperty('headers.host', `${server.host}:${server.port.toString()}`)
        t.expect(body).toHaveProperty('headers.content-type', 'application/x-www-form-urlencoded')
        t.expect(body).toHaveProperty('headers.transfer-encoding', 'chunked')
        t.expect(body).toHaveProperty('httpMethod', 'POST')
        t.expect(body).toHaveProperty('isBase64Encoded', false)
        t.expect(body).toHaveProperty('path', '/api/echo')
        t.expect(body).toHaveProperty('queryStringParameters', { ding: 'dong' })
      })
    })
  })

  test('should return an empty body for a function with no body when redirecting', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async () =>
            Promise.resolve({
              statusCode: 200,
            }),
        })

      await builder.build()

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
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
            redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event: HandlerEvent) =>
            Promise.resolve({
              statusCode: 200,
              body: JSON.stringify(event),
            }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const form = new FormData()
        form.append('some', 'thing')
        const rsp = new Response(form)
        const expectedResponseBody = await rsp.text()

        const response = await fetch(`${server.url}/api/echo?ding=dong`, {
          method: 'POST',
          body: form,
        })
        const body = await response.json()

        t.expect(body).toHaveProperty('headers.host', `${server.host}:${server.port.toString()}`)
        t.expect((body as { headers: { 'content-type': string } }).headers['content-type']).toMatch(
          /^multipart\/form-data; ?boundary=.+/,
        )
        t.expect(body).toHaveProperty('headers.content-length', '164')
        t.expect(body).toHaveProperty('httpMethod', 'POST')
        t.expect(body).toHaveProperty('isBase64Encoded', true)
        t.expect(body).toHaveProperty('path', '/api/echo')
        t.expect(body).toHaveProperty('queryStringParameters', { ding: 'dong' })
        t.expect(body).toHaveProperty('body', expectedResponseBody)
      })
    })
  })

  test.runIf(gte(version, '20.12.2'))('should support functions with streaming responses', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const chunks: string[] = []

        const res = await fetch(`${server.url}/.netlify/functions/streamer`)

        let lastTimestamp = 0

        t.expect(res.body).not.toBeNull()
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const body = res.body!

        for await (const chunk of body) {
          const now = Date.now()
          t.expect(now > lastTimestamp).toBe(true)
          lastTimestamp = now
          chunks.push(Buffer.from(chunk).toString())
        }

        t.expect(chunks).toStrictEqual(['one', 'two', 'three'])
      })
    })
  })
})
