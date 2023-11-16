import path from 'path'
import { fileURLToPath } from 'url'

import fetch from 'node-fetch'
import { describe, test } from 'vitest'

import { tryAndLogOutput, withDevServer } from '../../utils/dev-server.js'
import got from '../../utils/got.js'
import { pause } from '../../utils/pause.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const testMatrix = [{ args: [] }, { args: ['esbuild'] }]

const WAIT_WRITE = 3000

// TODO: Remove function and got
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

describe.concurrent.each(testMatrix)('withSiteBuilder with args: $args', ({ args }) => {
  test('Updates a JavaScript function when its main file is modified', async (t) => {
    await withSiteBuilder('js-function-update-main-file', async (builder) => {
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
          handler: async () => ({
            statusCode: 200,
            body: 'Hello',
          }),
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(
          async () =>
            t
              .expect(await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) => res.text()))
              .toEqual('Hello'),
          outputBuffer,
        )

        await pause(WAIT_WRITE)

        await builder
          .withFunction({
            path: 'hello.js',
            handler: async () => ({
              statusCode: 200,
              body: 'Goodbye',
            }),
          })
          .buildAsync()

        await waitForLogMatching('Reloaded function hello')

        const response = await fetch(`http://localhost:${port}/.netlify/functions/hello`)

        t.expect(await response.text()).toEqual('Goodbye')
      })
    })
  })

  test('Updates a TypeScript function when its main file is modified', async (t) => {
    await withSiteBuilder('ts-function-update-main-file', async (builder) => {
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
          content: `
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
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(
          async () =>
            t
              .expect(await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) => res.text()))
              .toEqual('Modern Web Development on the JAMStack'),
          outputBuffer,
        )

        await pause(WAIT_WRITE)

        await builder
          .withContentFile({
            path: 'functions/hello.ts',
            content: `
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
          .buildAsync()

        await waitForLogMatching('Reloaded function hello')

        const response = await fetch(`http://localhost:${port}/.netlify/functions/hello`)

        t.expect(await response.text()).toEqual('Modern Web Development on the Jamstack')
      })
    })
  })

  test('Updates a JavaScript function when a supporting file is modified', async (t) => {
    await withSiteBuilder('js-function-update-supporting-file', async (builder) => {
      const functionsConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions', ...functionsConfig },
          },
        })
        .withContentFiles([
          { path: 'functions/lib/util.js', content: `exports.bark = () => 'WOOF!'` },
          {
            path: 'functions/hello.js',
            content: `const { bark } = require('./lib/util'); exports.handler = async () => ({ statusCode: 200, body: bark() })`,
          },
        ])
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          t.expect(await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) => res.text())).toEqual(
            'WOOF!',
          )
        }, outputBuffer)

        await pause(WAIT_WRITE)

        await builder
          .withContentFile({ path: 'functions/lib/util.js', content: `exports.bark = () => 'WOOF WOOF!'` })
          .buildAsync()

        // eslint-disable-next-line unicorn/prefer-ternary
        if (args.includes('esbuild')) {
          await waitForLogMatching('Reloaded function hello')
        } else {
          // no message printed when using not esbuild
          await pause(WAIT_WRITE)
        }

        const response = await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) => res.text())

        t.expect(response).toEqual('WOOF WOOF!')
      })
    })
  })

  test('Updates a TypeScript function when a supporting file is modified', async (t) => {
    await withSiteBuilder('ts-function-update-supporting-file', async (builder) => {
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
            content: `
  const title: string = 'Modern Web Development on the JAMStack'

  export { title }
  `,
          },
          {
            path: 'functions/hello.ts',
            content: `
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
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          t.expect(await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) => res.text())).toEqual(
            'Modern Web Development on the JAMStack',
          )
        }, outputBuffer)

        await pause(WAIT_WRITE)

        await builder
          .withContentFile({
            path: 'functions/lib/util.ts',
            content: `
  const title: string = 'Modern Web Development on the Jamstack'

  export { title }
  `,
          })
          .buildAsync()

        await waitForLogMatching('Reloaded function hello')

        const response = await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) => res.text())

        t.expect(response).toEqual('Modern Web Development on the Jamstack')
      })
    })
  })

  test('Adds a new JavaScript function when a function file is created', async (t) => {
    await withSiteBuilder('js-function-create-function-file', async (builder) => {
      const bundlerConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            ...bundlerConfig,
          },
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          const unauthenticatedResponse = await gotCatch404(`http://localhost:${port}/.netlify/functions/hello`)

          t.expect(unauthenticatedResponse.statusCode).toBe(404)
        }, outputBuffer)

        await pause(WAIT_WRITE)

        await builder
          .withFunction({
            path: 'hello.js',
            handler: async () => ({
              statusCode: 200,
              body: 'Hello',
            }),
          })
          .buildAsync()

        await waitForLogMatching('Loaded function hello')

        const response = await got(`http://localhost:${port}/.netlify/functions/hello`).text()

        t.expect(response).toEqual('Hello')
      })
    })
  })

  test('Adds a new TypeScript function when a function file is created', async (t) => {
    await withSiteBuilder('ts-function-create-function-file', async (builder) => {
      const bundlerConfig = args.includes('esbuild') ? { node_bundler: 'esbuild' } : {}

      await builder
        .withFunction({
          path: 'functions/help.ts',
          handler: async () => ({
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
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          const unauthenticatedResponse = await gotCatch404(`http://localhost:${port}/.netlify/functions/hello`)

          t.expect(unauthenticatedResponse.statusCode).toBe(404)
        }, outputBuffer)

        await pause(WAIT_WRITE)

        await builder
          .withContentFile({
            path: 'functions/hello.ts',
            content: `
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
          .buildAsync()

        await waitForLogMatching('Loaded function hello')

        const response = await got(`http://localhost:${port}/.netlify/functions/hello`).text()

        t.expect(response).toEqual('Modern Web Development on the Jamstack')
      })
    })
  })

  test('Removes a function when a function file is deleted', async (t) => {
    await withSiteBuilder('function-remove-function-file', async (builder) => {
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
          handler: async () => ({
            statusCode: 200,
            body: 'Hello',
          }),
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          t.expect(await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) => res.text())).toEqual(
            'Hello',
          )
        }, outputBuffer)

        await pause(WAIT_WRITE)

        await builder
          .withoutFile({
            path: 'functions/hello.js',
          })
          .buildAsync()

        await waitForLogMatching('Removed function hello')

        const { statusCode } = await gotCatch404(`http://localhost:${port}/.netlify/functions/hello`)

        t.expect(statusCode).toBe(404)
      })
    })
  })

  test(`should pick up new function files even through debounce`, async (t) => {
    await withSiteBuilder('function-file-updates', async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
          },
        })
        .withContentFile({
          path: 'functions/hello/dist/index.js',
          content: `module.exports = "foo"`,
        })
        .withContentFile({
          path: 'functions/hello/dist/index.d.ts',
          content: `export default "foo"`,
        })
        .withContentFile({
          path: 'functions/hello/index.js',
          content: `
const response = require("./dist")
exports.handler = async () => ({
  statusCode: 200,
  body: response
})`,
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const resp = await fetch(`${server.url}/.netlify/functions/hello`)
        t.expect(await resp.text()).toEqual('foo')

        await builder
          .withContentFile({
            path: 'functions/hello/dist/index.d.ts',
            content: `export default "bar"`,
          })
          .buildAsync()

        await builder
          .withContentFile({
            path: 'functions/hello/dist/index.js',
            content: `module.exports = "bar"`,
          })
          .buildAsync()

        const DEBOUNCE_WAIT = 150
        await pause(DEBOUNCE_WAIT)

        const resp2 = await fetch(`${server.url}/.netlify/functions/hello`)
        t.expect(await resp2.text()).toEqual('bar')
      })
    })
  })

  test('Serves functions from the internal functions directory', async (t) => {
    await withSiteBuilder('function-internal', async (builder) => {
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
          pathPrefix: '.netlify/functions-internal',
          handler: async () => ({
            statusCode: 200,
            body: 'Internal',
          }),
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          t.expect(await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) => res.text())).toEqual(
            'Internal',
          )
        }, outputBuffer)

        await pause(WAIT_WRITE)

        await builder
          .withFunction({
            path: 'hello.js',
            pathPrefix: '.netlify/functions-internal',
            handler: async () => ({
              statusCode: 200,
              body: 'Internal updated',
            }),
          })
          .buildAsync()

        await waitForLogMatching('Reloaded function hello')

        const response = await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) => res.text())

        t.expect(response).toEqual('Internal updated')
      })
    })
  })

  test('User functions take precedence over internal functions', async (t) => {
    await withSiteBuilder('function-internal-priority', async (builder) => {
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
          handler: async () => ({
            statusCode: 200,
            body: 'User',
          }),
        })
        .withFunction({
          path: 'hello.js',
          pathPrefix: '.netlify/functions-internal',
          handler: async () => ({
            statusCode: 200,
            body: 'Internal',
          }),
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port, waitForLogMatching }) => {
        await tryAndLogOutput(async () => {
          t.expect(await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) => res.text())).toEqual(
            'User',
          )
        }, outputBuffer)

        await pause(WAIT_WRITE)

        await builder
          .withFunction({
            path: 'hello.js',
            handler: async () => ({
              statusCode: 200,
              body: 'User updated',
            }),
          })
          .withFunction({
            path: 'hello.js',
            pathPrefix: '.netlify/functions-internal',
            handler: async () => ({
              statusCode: 200,
              body: 'Internal updated',
            }),
          })
          .buildAsync()

        await waitForLogMatching('Reloaded function hello')

        const response = await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) => res.text())

        t.expect(response).toEqual('User updated')
      })
    })
  })

  test('Serves functions with a `.js` extension', async (t) => {
    await withSiteBuilder('function-mjs', async (builder) => {
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
          path: 'functions/hello.js',
          content: `
  const handler = async () => {
    return {
      statusCode: 200,
      body: 'Hello, world!'
    }
  }

  export { handler }
            `,
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          t.expect(await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) => res.text())).toEqual(
            'Hello, world!',
          )
        }, outputBuffer)
      })
    })
  })

  test('Serves functions inside a "type=module" package', async (t) => {
    await withSiteBuilder('function-type-module', async (builder) => {
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
          handler: async () => ({
            statusCode: 200,
            body: 'hello from es module!',
          }),
          esm: true,
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          t.expect(await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) => res.text())).toEqual(
            'hello from es module!',
          )
        }, outputBuffer)
      })
    })
  })

  test('Resembles base64 encoding of production', async (t) => {
    await withSiteBuilder('function-base64-encoding', async (builder) => {
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
          handler: async (event) => ({
            statusCode: 200,
            body: event.isBase64Encoded ? 'base64' : 'plain',
          }),
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          t.expect(
            await fetch(`http://localhost:${port}/.netlify/functions/echoEncoding`, {
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
    await withSiteBuilder('function-with-included-files', async (builder) => {
      await builder
        .withContentFiles([
          {
            path: 'files/one.json',
            content: `{"data": "one"}`,
          },
          {
            path: 'files/two.json',
            content: `{"data": "two"}`,
          },
        ])
        .withFunction({
          path: 'hello.js',
          handler: async (event) => {
            const { name } = event.queryStringParameters

            // eslint-disable-next-line n/global-require, no-undef
            const { data } = require(`../files/${name}.json`)

            return {
              statusCode: 200,
              body: data,
            }
          },
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions', included_files: ['files/*'], node_bundler: 'esbuild' },
          },
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          const [responseHelloNameOne, responseHelloNameTwo] = await Promise.all([
            fetch(`http://localhost:${port}/.netlify/functions/hello?name=one`).then((res) => res.text()),
            fetch(`http://localhost:${port}/.netlify/functions/hello?name=two`).then((res) => res.text()),
          ])
          t.expect(responseHelloNameOne).toEqual('one')
          t.expect(responseHelloNameTwo).toEqual('two')
        }, outputBuffer)
      })
    })
  })

  test('Uses sourcemaps to show correct paths and locations in stack trace', async (t) => {
    await withSiteBuilder('function-with-sourcemaps', async (builder) => {
      await builder
        .withFunction({
          path: 'hello.js',
          handler: async () => {
            throw new Error('Something went wrong')
          },
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions', node_bundler: 'esbuild' },
          },
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ port }) => {
        const responseWithTrace = await fetch(`http://localhost:${port}/.netlify/functions/hello`).then((res) =>
          res.text(),
        )
        t.expect(responseWithTrace.includes(path.join(builder.directory, 'functions', 'hello.js'))).toBe(true)
        t.expect(responseWithTrace.includes(path.join('.netlify', 'functions-serve'))).toBe(false)
      })
    })
  })

  test('Populates the `event` argument', async (t) => {
    await withSiteBuilder('function-event', async (builder) => {
      await builder
        .withFunction({
          path: 'hello.js',
          handler: async (event) => ({
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
        .buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          const {
            httpMethod,
            path: thePath,
            rawQuery,
            rawUrl,
          } = await fetch(`http://localhost:${port}/.netlify/functions/hello?net=lify&jam=stack`).then((res) =>
            res.json(),
          )

          t.expect(httpMethod).toEqual('GET')
          t.expect(thePath).toEqual('/.netlify/functions/hello')
          t.expect(rawQuery).toEqual('net=lify&jam=stack')
          t.expect(rawUrl).toEqual(`http://localhost:${port}/.netlify/functions/hello?net=lify&jam=stack`)
        }, outputBuffer)
      })
    })
  })

  test('Throws an error when the function returns invalid `body`', async (t) => {
    await withSiteBuilder('function-invalid-body', async (builder) => {
      await builder
        .withFunction({
          path: 'hello.js',
          handler: async () => ({
            statusCode: 200,
            body: 42,
          }),
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
          },
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          const errorResponse = await fetch(`http://localhost:${port}/.netlify/functions/hello`)

          t.expect(errorResponse.status).toBe(500)
          t.expect(await errorResponse.text()).toEqual(
            'Your function response must have a string or a stream body. You gave: 42',
          )
        }, outputBuffer)
      })
    })
  })

  test('Throws an error when the function returns invalid `statusCode`', async (t) => {
    await withSiteBuilder('function-invalid-statuscode', async (builder) => {
      await builder
        .withFunction({
          path: 'hello.js',
          handler: async () => ({
            statusCode: null,
            body: 42,
          }),
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
          },
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          const errorResponse = await fetch(`http://localhost:${port}/.netlify/functions/hello`)

          t.expect(errorResponse.status).toBe(500)
          t.expect(await errorResponse.text()).toEqual(
            'Your function response must have a numerical statusCode. You gave: null',
          )
        }, outputBuffer)
      })
    })
  })

  test('Ensures watcher watches included files', async (t) => {
    await withSiteBuilder('function-with-included-files-watch', async (builder) => {
      await builder
        .withContentFiles([
          {
            path: 'files/one.json',
            content: `{"data": "one"}`,
          },
          {
            path: 'files/two.json',
            content: `{"data": "two"}`,
          },
        ])
        .withFunction({
          path: 'hello.js',
          handler: async (event) => {
            // eslint-disable-next-line n/global-require, no-undef
            const { readFileSync } = require('fs')
            const { name } = event.queryStringParameters
            const { data } = JSON.parse(readFileSync(`${__dirname}/../files/${name}.json`, 'utf-8'))

            return {
              statusCode: 200,
              body: data,
            }
          },
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
        .buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ outputBuffer, port }) => {
        await tryAndLogOutput(async () => {
          const [responseHelloNameOne, responseHelloNameTwo] = await Promise.all([
            fetch(`http://localhost:${port}/.netlify/functions/hello?name=one`).then((res) => res.text()),
            fetch(`http://localhost:${port}/.netlify/functions/hello?name=two`).then((res) => res.text()),
          ])
          t.expect(responseHelloNameOne).toEqual('one')
          t.expect(responseHelloNameTwo).toEqual('two')
        }, outputBuffer)

        await builder
          .withContentFiles([
            {
              path: 'files/one.json',
              content: `{"data": "three"}`,
            },
            {
              path: 'files/two.json',
              content: `{"data": "four"}`,
            },
          ])
          .buildAsync()

        // wait for the watcher to rebuild the function
        const delay = 1000
        await pause(delay)

        t.expect(outputBuffer.some((buffer) => /.*Reloaded function hello.*/.test(buffer.toString()))).toBe(true)
        await tryAndLogOutput(async () => {
          const [responseHelloNameOne, responseHelloNameTwo] = await Promise.all([
            fetch(`http://localhost:${port}/.netlify/functions/hello?name=one`).then((res) => res.text()),
            fetch(`http://localhost:${port}/.netlify/functions/hello?name=two`).then((res) => res.text()),
          ])
          t.expect(responseHelloNameOne).toEqual('three')
          t.expect(responseHelloNameTwo).toEqual('four')
        }, outputBuffer)
      })
    })
  })
})
