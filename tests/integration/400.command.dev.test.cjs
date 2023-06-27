// Handlers are meant to be async outside tests
const process = require('process')

// eslint-disable-next-line ava/use-test
const avaTest = require('ava')
const { isCI } = require('ci-info')
const FormData = require('form-data')
const { gte } = require('semver')

const { withDevServer } = require('./utils/dev-server.cjs')
const got = require('./utils/got.cjs')
const { pause } = require('./utils/pause.cjs')
const { withSiteBuilder } = require('./utils/site-builder.cjs')

const test = isCI ? avaTest.serial.bind(avaTest) : avaTest

test('should use [build.environment] and not [context.production.environment]', async (t) => {
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

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/.netlify/functions/env`).text()
      t.is(response, 'DEFAULT_CONTEXT')
    })
  })
})

test('should use [context.production.environment] when --context=production', async (t) => {
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

    await withDevServer({ cwd: builder.directory, context: 'production' }, async (server) => {
      const response = await got(`${server.url}/.netlify/functions/env`).text()
      t.is(response, 'PRODUCTION_CONTEXT')
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
        handler: async () => ({
          statusCode: 200,
          body: `${process.env.TEST}`,
        }),
      })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' } }, async (server) => {
      const response = await got(`${server.url}/.netlify/functions/env`).text()
      t.is(response, 'FROM_PROCESS_ENV')
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
        handler: async () => ({
          statusCode: 200,
          body: `${process.env.TEST}`,
        }),
      })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory, env: { TEST: 'FROM_PROCESS_ENV' } }, async (server) => {
      const response = await got(`${server.url}/.netlify/functions/env`).text()
      t.is(response, 'FROM_PROCESS_ENV')
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

      t.is(response.statusCode, 500)
      t.true(response.body.startsWith('no lambda response.'))
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
      t.is(response, 'true')
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
      t.is(response, 'dev')
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
      t.is(response, 'deploy-preview')
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
      t.is(response, 'ping')
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
      t.is(response.body, undefined)
      t.is(response.headers.host, `${server.host}:${server.port}`)
      t.is(response.httpMethod, 'GET')
      t.is(response.isBase64Encoded, true)
      t.is(response.path, '/api/echo')
      t.deepEqual(response.queryStringParameters, { ding: 'dong' })
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

      t.is(response.body, 'some=thing')
      t.is(response.headers.host, `${server.host}:${server.port}`)
      t.is(response.headers['content-type'], 'application/x-www-form-urlencoded')
      t.is(response.headers['transfer-encoding'], 'chunked')
      t.is(response.httpMethod, 'POST')
      t.is(response.isBase64Encoded, false)
      t.is(response.path, '/api/echo')
      t.deepEqual(response.queryStringParameters, { ding: 'dong' })
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

      t.is(response.body, '')
      t.is(response.statusCode, 200)
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

if (gte(process.version, '18.0.0')) {
  test('should support functions with streaming responses', async (t) => {
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

          t.true(now > lastTimestamp)

          lastTimestamp = now
          chunks.push(chunk.toString())
        })

        await pause(500)

        t.deepEqual(chunks, ['one', 'two', 'three'])
      })
    })
  })
}
