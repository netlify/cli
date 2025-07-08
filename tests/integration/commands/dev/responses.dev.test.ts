// Handlers are meant to be async outside tests
import path from 'path'

import type { HandlerEvent } from '@netlify/functions'

import { describe, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

describe.concurrent('commands/responses.dev', () => {
  test('should return index file when / is accessed', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({
        path: 'index.html',
        content: '<h1>⊂◉‿◉つ</h1>',
      })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(server.url).then((res) => res.text())
        t.expect(response).toEqual('<h1>⊂◉‿◉つ</h1>')
      })
    })
  })

  test('should return user defined headers when / is accessed', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({
        path: 'index.html',
        content: '<h1>⊂◉‿◉つ</h1>',
      })

      const headerName = 'X-Frame-Options'
      const headerValue = 'SAMEORIGIN'
      builder.withHeadersFile({ headers: [{ path: '/*', headers: [`${headerName}: ${headerValue}`] }] })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const { headers } = await fetch(server.url)
        t.expect(headers.get(headerName.toLowerCase())).toEqual(headerValue)
      })
    })
  })

  test('should return user defined headers when non-root path is accessed', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({
        path: 'foo/index.html',
        content: '<h1>⊂◉‿◉つ</h1>',
      })

      const headerName = 'X-Frame-Options'
      const headerValue = 'SAMEORIGIN'
      builder.withHeadersFile({ headers: [{ path: '/*', headers: [`${headerName}: ${headerValue}`] }] })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const { headers } = await fetch(`${server.url}/foo`)
        t.expect(headers.get(headerName.toLowerCase())).toEqual(headerValue)
      })
    })
  })

  test('should return response from a function with setTimeout', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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

      await builder.build()

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
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'builder.js',
        handler: async () =>
          Promise.resolve({
            statusCode: 200,
            body: 'ping',
          }),
      })

      await builder.build()

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
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: path.join('echo', 'echo.js'),
        handler: async (event: HandlerEvent) =>
          Promise.resolve({
            statusCode: 200,
            body: JSON.stringify({ rawUrl: event.rawUrl }),
            metadata: { builder_function: true },
          }),
      })

      await builder.build()

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
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withEnvFile({ path: '.env.development', env: { ENV_DEV_TEST: 'FROM_DEV_FILE' } })
        .withFunction({
          path: 'env.js',
          handler: async () =>
            Promise.resolve({
              statusCode: 200,
              body: process.env.ENV_DEV_TEST ?? '',
              metadata: { builder_function: true },
            }),
        })

      await builder.build()

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
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'env.js',
        handler: async () =>
          Promise.resolve({
            statusCode: 200,
            body: process.env.TEST ?? '',
            metadata: { builder_function: true },
          }),
      })

      await builder.build()

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
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: { environment: { BUILD_ENV_TEST: 'FROM_CONFIG_FILE' } },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'env.js',
          handler: async () =>
            Promise.resolve({
              statusCode: 200,
              body: process.env.BUILD_ENV_TEST ?? '',
              metadata: { builder_function: true },
            }),
        })

      await builder.build()

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
    await withSiteBuilder(t, async (builder) => {
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
          handler: async () =>
            Promise.resolve({
              statusCode: 200,
              body: process.env.CONTEXT_TEST,
            }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('DEV_CONTEXT')
      })
    })
  })

  test('should inject env vars based on [dev].envFiles file order', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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
          handler: async () =>
            Promise.resolve({
              statusCode: 200,
              body: `${process.env.TEST_1 ?? ''}__${process.env.TEST2 ?? ''}`,
            }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/env`).then((res) => res.text())
        t.expect(response).toEqual('FROM_PRODUCTION_FILE__FROM_DEVELOPMENT_FILE')
        t.expect(server.output.includes('Ignored .env.development file')).toBe(true)
        t.expect(server.output.includes('Ignored .env file')).toBe(true)
      })
    })
  })

  test('should inject html snippet from dev.processing.html.injections before closing head tag', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const pageHtml = '<html><head><title>title</title></head><body><h1>header</h1></body></html>'

      builder
        .withNetlifyToml({
          config: {
            plugins: [{ package: './plugins/injector' }],
          },
        })
        .withBuildPlugin({
          name: 'injector',
          plugin: {
            onPreDev: async ({ netlifyConfig }) => {
              // @ts-expect-error(ndhoule): NetlifyConfig.dev is untyped
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              netlifyConfig.dev = {
                // @ts-expect-error(ndhoule): NetlifyConfig.dev is untyped
                ...netlifyConfig.dev,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                processing: {
                  // @ts-expect-error(ndhoule): NetlifyConfig.dev is untyped
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                  ...netlifyConfig.dev?.processing,
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  html: {
                    // @ts-expect-error(ndhoule): NetlifyConfig.dev is untyped
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    ...netlifyConfig.dev?.processing?.html,
                    injections: [
                      // @ts-expect-error(ndhoule): NetlifyConfig.dev is untyped
                      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                      ...(netlifyConfig.dev?.processing?.html?.injections ?? []),
                      {
                        location: 'before_closing_head_tag',
                        html: '<script type="text/javascript" src="https://www.example.com"></script>',
                      },
                    ],
                  },
                },
              }
              return Promise.resolve(undefined)
            },
          },
        })
        .withContentFile({
          path: 'index.html',
          content: pageHtml,
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(server.url)
        const htmlResponse = await response.text()
        t.expect(htmlResponse).toEqual(
          pageHtml.replace('</head>', `<script type="text/javascript" src="https://www.example.com"></script></head>`),
        )
      })
    })
  })

  test('should inject html snippet from dev.processing.html.injections before closing body tag', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const pageHtml = '<html><head><title>title</title></head><body><h1>header</h1></body></html>'

      builder
        .withNetlifyToml({
          config: {
            plugins: [{ package: './plugins/injector' }],
          },
        })
        .withBuildPlugin({
          name: 'injector',
          plugin: {
            onPreDev: async ({ netlifyConfig }) => {
              // @ts-expect-error(ndhoule): NetlifyConfig.dev is untyped
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              netlifyConfig.dev = {
                // @ts-expect-error(ndhoule): NetlifyConfig.dev is untyped
                ...netlifyConfig.dev,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                processing: {
                  // @ts-expect-error(ndhoule): NetlifyConfig.dev is untyped
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                  ...netlifyConfig.dev?.processing,
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  html: {
                    // @ts-expect-error(ndhoule): NetlifyConfig.dev is untyped
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    ...netlifyConfig.dev?.processing?.html,
                    injections: [
                      // @ts-expect-error(ndhoule): NetlifyConfig.dev is untyped
                      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                      ...(netlifyConfig.dev?.processing?.html?.injections ?? []),
                      {
                        location: 'before_closing_body_tag',
                        html: '<script type="text/javascript" src="https://www.example.com"></script>',
                      },
                    ],
                  },
                },
              }
              return Promise.resolve(undefined)
            },
          },
        })
        .withContentFile({
          path: 'index.html',
          content: pageHtml,
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(server.url)
        const htmlResponse = await response.text()
        t.expect(htmlResponse).toEqual(
          pageHtml.replace('</body>', `<script type="text/javascript" src="https://www.example.com"></script></body>`),
        )
      })
    })
  })
})
