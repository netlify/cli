import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { HandlerEvent } from '@netlify/functions'
import fetch from 'node-fetch'
import { describe, test } from 'vitest'
import js from 'dedent'
import ts from 'dedent'

import { tryAndLogOutput, withDevServer } from '../../utils/dev-server.js'
import { pause } from '../../utils/pause.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const testMatrix = [{ args: [] }, { args: ['esbuild'] }]

const WAIT_WRITE = 3000
const DEBOUNCE_WAIT = 150

describe.concurrent.each(testMatrix)('withSiteBuilder with args: $args', ({ args }) => {
  test('Updates a JavaScript function when its main file is modified', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const bundlerConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            ...bundlerConfig,
          },
        })
        .withFunction({
          path: 'hello.js',
          handler: async () =>
            Promise.resolve({
              statusCode: 200,
              body: 'Hello',
            }),
        })
        .build()

      // eslint-disable-next-line @typescript-eslint/unbound-method
      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          t.expect(
            await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) => res.text()),
          ).toEqual('Hello')
        }, outputBuffer)

        await waitForLogMatching('Loaded function hello', { timeout: WAIT_WRITE })

        await builder
          .withFunction({
            path: 'hello.js',
            handler: async () =>
              Promise.resolve({
                statusCode: 200,
                body: 'Goodbye',
              }),
          })
          .build()

        await waitForLogMatching('Reloaded function hello', { timeout: WAIT_WRITE })

        const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`)

        t.expect(await response.text()).toEqual('Goodbye')
      })
    })
  })

  test('Updates a TypeScript function when its main file is modified', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const bundlerConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            ...bundlerConfig,
          },
        })
        .withContentFile({
          path: 'functions/hello.ts',
          content: ts`
            interface Book {
              title: string
              author: string
            }

            const handler = async () => {
              const book1: Book = {
                title: 'Modern Web Development on the JAMStack',
                author: 'Mathias Biilmann & Phil Hawksworth'
              }

              return {
                statusCode: 200,
                body: book1.title
              }
            }

            export { handler }
          `,
        })
        .build()

      // eslint-disable-next-line @typescript-eslint/unbound-method
      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          t.expect(
            await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) => res.text()),
          ).toEqual('Modern Web Development on the JAMStack')
        }, outputBuffer)

        await waitForLogMatching('Loaded function hello', { timeout: WAIT_WRITE })

        await builder
          .withContentFile({
            path: 'functions/hello.ts',
            content: ts`
              interface Book {
                title: string
                author: string
              }

              const handler = async () => {
                const book1: Book = {
                  title: 'Modern Web Development on the Jamstack',
                  author: 'Mathias Biilmann & Phil Hawksworth'
                }

                return {
                  statusCode: 200,
                  body: book1.title
                }
              }

              export { handler }
            `,
          })
          .build()

        await waitForLogMatching('Reloaded function hello', { timeout: WAIT_WRITE })

        const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`)

        t.expect(await response.text()).toEqual('Modern Web Development on the Jamstack')
      })
    })
  })

  test('Updates a JavaScript function when a supporting file is modified', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const functionsConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions', ...functionsConfig },
          },
        })
        .withContentFiles([
          { path: 'functions/lib/util.js', content: js`exports.bark = () => 'WOOF!'` },
          {
            path: 'functions/hello.js',
            content: js`const { bark } = require('./lib/util'); exports.handler = async () => ({ statusCode: 200, body: bark() })`,
          },
        ])
        .build()

      // eslint-disable-next-line @typescript-eslint/unbound-method
      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          t.expect(
            await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) => res.text()),
          ).toEqual('WOOF!')
        }, outputBuffer)

        await waitForLogMatching('Loaded function hello', { timeout: WAIT_WRITE })

        await builder
          .withContentFile({ path: 'functions/lib/util.js', content: js`exports.bark = () => 'WOOF WOOF!'` })
          .build()

        if (args.includes('esbuild')) {
          await waitForLogMatching('Reloaded function hello', { timeout: WAIT_WRITE })
        } else {
          // no message printed when not using esbuild
          await pause(WAIT_WRITE)
        }

        const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) =>
          res.text(),
        )

        t.expect(response).toEqual('WOOF WOOF!')
      })
    })
  })

  test('Updates a TypeScript function when a supporting file is modified', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const functionsConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions', ...functionsConfig },
          },
        })
        .withContentFiles([
          {
            path: 'functions/lib/util.ts',
            content: ts`
              const title: string = 'Modern Web Development on the JAMStack'

              export { title }
            `,
          },
          {
            path: 'functions/hello.ts',
            content: ts`
              import { title } from './lib/util'

              interface Book {
                title: string
                author: string
              }

              const handler = async () => {
                const book1: Book = {
                  title,
                  author: 'Mathias Biilmann & Phil Hawksworth'
                }

                return {
                  statusCode: 200,
                  body: book1.title
                }
              }

              export { handler }
            `,
          },
        ])
        .build()

      // eslint-disable-next-line @typescript-eslint/unbound-method
      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          t.expect(
            await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) => res.text()),
          ).toEqual('Modern Web Development on the JAMStack')
        }, outputBuffer)

        await waitForLogMatching('Loaded function hello', { timeout: WAIT_WRITE })

        await builder
          .withContentFile({
            path: 'functions/lib/util.ts',
            content: ts`
              const title: string = 'Modern Web Development on the Jamstack'

              export { title }
            `,
          })
          .build()

        await waitForLogMatching('Reloaded function hello', { timeout: WAIT_WRITE })

        const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) =>
          res.text(),
        )

        t.expect(response).toEqual('Modern Web Development on the Jamstack')
      })
    })
  })

  test('Adds a new JavaScript function when a function file is created', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const bundlerConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            ...bundlerConfig,
          },
        })
        .build()

      // eslint-disable-next-line @typescript-eslint/unbound-method
      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          const unauthenticatedResponse = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`)

          t.expect(unauthenticatedResponse.status).toBe(404)
        }, outputBuffer)

        await pause(WAIT_WRITE)

        await builder
          .withFunction({
            path: 'hello.js',
            handler: async () =>
              Promise.resolve({
                statusCode: 200,
                body: 'Hello',
              }),
          })
          .build()

        await waitForLogMatching('Loaded function hello', { timeout: WAIT_WRITE })

        const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) =>
          res.text(),
        )

        t.expect(response).toEqual('Hello')
      })
    })
  })

  test('Adds a new TypeScript function when a function file is created', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const bundlerConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withFunction({
          path: 'functions/help.ts',
          handler: async () =>
            Promise.resolve({
              statusCode: 200,
              body: 'I need somebody. Not just anybody.',
            }),
          esm: true,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            ...bundlerConfig,
          },
        })
        .build()

      // eslint-disable-next-line @typescript-eslint/unbound-method
      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          const unauthenticatedResponse = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`)

          t.expect(unauthenticatedResponse.status).toBe(404)
        }, outputBuffer)

        await waitForLogMatching('Loaded function help', { timeout: WAIT_WRITE })

        await builder
          .withContentFile({
            path: 'functions/hello.ts',
            content: ts`
              interface Book {
                title: string
                author: string
              }

              const handler = async () => {
                const book1: Book = {
                  title: 'Modern Web Development on the Jamstack',
                  author: 'Mathias Biilmann & Phil Hawksworth'
                }

                return {
                  statusCode: 200,
                  body: book1.title
                }
              }

              export { handler }
            `,
          })
          .build()

        await waitForLogMatching('Loaded function hello', { timeout: WAIT_WRITE })

        const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) =>
          res.text(),
        )

        t.expect(response).toEqual('Modern Web Development on the Jamstack')
      })
    })
  })

  test('Removes a function when a function file is deleted', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const bundlerConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            ...bundlerConfig,
          },
        })
        .withFunction({
          path: 'hello.js',
          handler: async () =>
            Promise.resolve({
              statusCode: 200,
              body: 'Hello',
            }),
        })
        .build()

      // eslint-disable-next-line @typescript-eslint/unbound-method
      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          t.expect(
            await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) => res.text()),
          ).toEqual('Hello')
        }, outputBuffer)

        await waitForLogMatching('Loaded function hello', { timeout: WAIT_WRITE })

        await builder
          .withoutFile({
            path: 'functions/hello.js',
          })
          .build()

        await waitForLogMatching('Removed function hello', { timeout: WAIT_WRITE })

        const { status } = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`)

        t.expect(status).toBe(404)
      })
    })
  })

  test('should pick up new function files even through debounce', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
          },
        })
        .withContentFile({
          path: '/functions/hello/src/index.js',
          content: js`module.exports = "foo"`,
        })
        .withContentFile({
          path: '/functions/hello/src/index.d.ts',
          content: js`export default "foo"`,
        })
        .withContentFile({
          path: '/functions/hello/index.js',
          content: js`
            const response = require("./src")
            exports.handler = async () => ({
              statusCode: 200,
              body: response,
            })
          `,
        })
        .build()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const resp = await fetch(`${server.url}/.netlify/functions/hello`)
        t.expect(await resp.text()).toEqual('foo')

        await builder
          .withContentFile({
            path: '/functions/hello/src/index.d.ts',
            content: ts`export default "bar"`,
          })
          .build()

        await builder
          .withContentFile({
            path: '/functions/hello/src/index.js',
            content: js`module.exports = "bar"`,
          })
          .build()

        await pause(DEBOUNCE_WAIT)

        const resp2 = await fetch(`${server.url}/.netlify/functions/hello`)
        t.expect(await resp2.text()).toEqual('bar')
      })
    })
  })

  test('Serves functions from the internal functions directory', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const bundlerConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            ...bundlerConfig,
          },
        })
        .build()

      // eslint-disable-next-line @typescript-eslint/unbound-method
      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await builder
          .withFunction({
            path: 'hello.js',
            pathPrefix: '.netlify/functions-internal',
            handler: async () =>
              Promise.resolve({
                statusCode: 200,
                body: 'Internal',
              }),
          })
          .build()

        await waitForLogMatching('Loaded function hello', { timeout: WAIT_WRITE })

        await tryAndLogOutput(async () => {
          t.expect(
            await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) => res.text()),
          ).toEqual('Internal')
        }, outputBuffer)

        await builder
          .withFunction({
            path: 'hello.js',
            pathPrefix: '.netlify/functions-internal',
            handler: async () =>
              Promise.resolve({
                statusCode: 200,
                body: 'Internal updated',
              }),
          })
          .build()

        await waitForLogMatching('Reloaded function hello', { timeout: WAIT_WRITE })

        const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) =>
          res.text(),
        )

        t.expect(response).toEqual('Internal updated')
      })
    })
  })

  test('User functions take precedence over internal functions', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const bundlerConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            ...bundlerConfig,
          },
        })
        .withFunction({
          path: 'hello.js',
          handler: async () =>
            Promise.resolve({
              statusCode: 200,
              body: 'User',
            }),
        })
        .build()

      // eslint-disable-next-line @typescript-eslint/unbound-method
      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await builder
          .withFunction({
            path: 'hello.js',
            pathPrefix: '.netlify/functions-internal',
            handler: async () =>
              Promise.resolve({
                statusCode: 200,
                body: 'Internal',
              }),
          })
          .build()

        await tryAndLogOutput(async () => {
          t.expect(
            await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) => res.text()),
          ).toEqual('User')
        }, outputBuffer)

        await waitForLogMatching('Loaded function hello', { timeout: WAIT_WRITE })

        await builder
          .withFunction({
            path: 'hello.js',
            handler: async () =>
              Promise.resolve({
                statusCode: 200,
                body: 'User updated',
              }),
          })
          .withFunction({
            path: 'hello.js',
            pathPrefix: '.netlify/functions-internal',
            handler: async () =>
              Promise.resolve({
                statusCode: 200,
                body: 'Internal updated',
              }),
          })
          .build()

        await waitForLogMatching('Reloaded function hello', { timeout: WAIT_WRITE })

        const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) =>
          res.text(),
        )

        t.expect(response).toEqual('User updated')
      })
    })
  })

  test('Serves functions with a `.mjs` extension', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const bundlerConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            ...bundlerConfig,
          },
        })
        .withContentFile({
          path: 'functions/hello.mjs',
          content: js`
            const handler = async () => {
              return {
                statusCode: 200,
                body: 'Hello, world!'
              }
            }

            export { handler }
          `,
        })
        .build()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          t.expect(
            await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) => res.text()),
          ).toEqual('Hello, world!')
        }, outputBuffer)
      })
    })
  })

  test('Serves functions inside a "type=module" package', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const bundlerConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            ...bundlerConfig,
          },
        })
        .withPackageJson({
          packageJson: {
            type: 'module',
          },
        })
        .withFunction({
          path: 'hello.js',
          handler: async () =>
            Promise.resolve({
              statusCode: 200,
              body: 'hello from es module!',
            }),
          esm: true,
        })
        .build()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          t.expect(
            await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then((res) => res.text()),
          ).toEqual('hello from es module!')
        }, outputBuffer)
      })
    })
  })

  test('Resembles base64 encoding of production', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const bundlerConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            ...bundlerConfig,
          },
        })
        .withFunction({
          path: 'echoEncoding.js',
          handler: async (event: HandlerEvent) =>
            Promise.resolve({
              statusCode: 200,
              body: event.isBase64Encoded ? 'base64' : 'plain',
            }),
        })
        .build()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          t.expect(
            await fetch(`http://localhost:${port.toString()}/.netlify/functions/echoEncoding`, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            }).then((res) => res.text()),
          ).toEqual('base64')
        }, outputBuffer)
      })
    })
  })
})

describe.concurrent('serving functions', () => {
  test('Serves functions that dynamically load files included in the `functions.included_files` config property', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFiles([
          {
            path: 'files/one.json',
            content: JSON.stringify({ data: 'one' }),
          },
          {
            path: 'files/two.json',
            content: JSON.stringify({ data: 'two' }),
          },
        ])
        .withFunction({
          path: 'hello.js',
          handler: js`
            exports.handler = async (event) => {
              const fs = require('node:fs')
              const path = require('node:path')


              const { name } = event.queryStringParameters ?? {}
              const { data } = require(\`../files/\${name}.json\`)

              return Promise.resolve({
                statusCode: 200,
                body: data,
              })
            }
          `,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions', included_files: ['files/*'], node_bundler: 'esbuild' },
          },
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          const [responseHelloNameOne, responseHelloNameTwo] = await Promise.all([
            fetch(`http://localhost:${port.toString()}/.netlify/functions/hello?name=one`).then((res) => res.text()),
            fetch(`http://localhost:${port.toString()}/.netlify/functions/hello?name=two`).then((res) => res.text()),
          ])
          t.expect(responseHelloNameOne).toEqual('one')
          t.expect(responseHelloNameTwo).toEqual('two')
        }, outputBuffer)
      })
    })
  })

  test('Uses sourcemaps to show correct paths and locations in stack trace', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withFunction({
          path: 'hello.js',
          handler: async () => Promise.reject(new Error('Something went wrong')),
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions', node_bundler: 'esbuild' },
          },
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ port }) => {
        const responseWithTrace = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`).then(
          (res) => res.text(),
        )
        t.expect(responseWithTrace.includes(path.join(builder.directory, 'functions', 'hello.js'))).toBe(true)
        t.expect(responseWithTrace.includes(path.join('.netlify', 'functions-serve'))).toBe(false)
      })
    })
  })

  test('Populates the `event` argument', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withFunction({
          path: 'hello.js',
          handler: async (event: HandlerEvent) =>
            Promise.resolve({
              statusCode: 200,
              body: JSON.stringify(event),
            }),
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
          },
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          const {
            // @ts-expect-error TS(2339) FIXME: Property 'httpMethod' does not exist on type '{}'.
            httpMethod,
            // @ts-expect-error TS(2339) FIXME: Property 'path' does not exist on type '{}'.
            path: thePath,
            // @ts-expect-error TS(2339) FIXME: Property 'rawQuery' does not exist on type '{}'.
            rawQuery,
            // @ts-expect-error TS(2339) FIXME: Property 'rawUrl' does not exist on type '{}'.
            rawUrl,
          } = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello?net=lify&jam=stack`).then(
            (res) => res.json(),
          )

          t.expect(httpMethod).toEqual('GET')
          t.expect(thePath).toEqual('/.netlify/functions/hello')
          t.expect(rawQuery).toEqual('net=lify&jam=stack')
          t.expect(rawUrl).toEqual(`http://localhost:${port.toString()}/.netlify/functions/hello?net=lify&jam=stack`)
        }, outputBuffer)
      })
    })
  })

  test('Throws an error when the function returns invalid `body`', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withFunction({
          path: 'hello.js',
          handler: js`
            exports.handler = async () => {
              return Promise.resolve({
                statusCode: 200,
                body: 42,
              });
            }
          `,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
          },
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          const errorResponse = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`)

          t.expect(errorResponse.status).toBe(500)
          t.expect(await errorResponse.text()).toEqual(
            'Your function response must have a string or a stream body. You gave: 42',
          )
        }, outputBuffer)
      })
    })
  })

  test('Throws an error when the function returns invalid `statusCode`', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withFunction({
          path: 'hello.js',
          // @ts-expect-error(ndhoule): statusCode breaks type contract
          handler: async () =>
            Promise.resolve({
              statusCode: null,
              body: 'hello',
            }),
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
          },
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          const errorResponse = await fetch(`http://localhost:${port.toString()}/.netlify/functions/hello`)

          t.expect(errorResponse.status).toBe(500)
          t.expect(await errorResponse.text()).toEqual(
            'Your function response must have a numerical statusCode. You gave: null',
          )
        }, outputBuffer)
      })
    })
  })

  test('Ensures watcher watches included files', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFiles([
          {
            path: 'files/one.json',
            content: JSON.stringify({ data: 'one' }),
          },
          {
            path: 'files/two.json',
            content: JSON.stringify({ data: 'two' }),
          },
        ])
        .withFunction({
          path: 'hello.js',
          handler: js`
            exports.handler = async (event) => {
              const fs = require('node:fs')
              const path = require('node:path')

              const { name } = event.queryStringParameters ?? {}
              const { data } = JSON.parse(fs.readFileSync(path.join(__dirname, \`../files/\${name}.json\`), 'utf-8'))

              return Promise.resolve({
                statusCode: 200,
                body: data,
              })
            }
          `,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: {
              directory: 'functions',
              included_files: ['files/*'],
              node_bundler: 'esbuild',
            },
          },
        })
        .build()

      // eslint-disable-next-line @typescript-eslint/unbound-method
      await withDevServer({ cwd: builder.directory }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          const [responseHelloNameOne, responseHelloNameTwo] = await Promise.all([
            fetch(`http://localhost:${port.toString()}/.netlify/functions/hello?name=one`).then((res) => res.text()),
            fetch(`http://localhost:${port.toString()}/.netlify/functions/hello?name=two`).then((res) => res.text()),
          ])
          t.expect(responseHelloNameOne).toEqual('one')
          t.expect(responseHelloNameTwo).toEqual('two')
        }, outputBuffer)

        await builder
          .withContentFiles([
            {
              path: 'files/one.json',
              content: JSON.stringify({ data: 'three' }),
            },
            {
              path: 'files/two.json',
              content: JSON.stringify({ data: 'four' }),
            },
          ])
          .build()

        await waitForLogMatching('Reloaded function hello', { timeout: 1000 })

        t.expect(outputBuffer.some((buffer) => /.*Reloaded function hello.*/.test(buffer.toString()))).toBe(true)
        await tryAndLogOutput(async () => {
          const [responseHelloNameOne, responseHelloNameTwo] = await Promise.all([
            fetch(`http://localhost:${port.toString()}/.netlify/functions/hello?name=one`).then((res) => res.text()),
            fetch(`http://localhost:${port.toString()}/.netlify/functions/hello?name=two`).then((res) => res.text()),
          ])
          t.expect(responseHelloNameOne).toEqual('three')
          t.expect(responseHelloNameTwo).toEqual('four')
        }, outputBuffer)
      })
    })
  })
})
