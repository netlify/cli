const { join } = require('path')

// eslint-disable-next-line ava/use-test
const avaTest = require('ava')
const { isCI } = require('ci-info')

const { tryAndLogOutput, withDevServer } = require('./utils/dev-server.cjs')
const got = require('./utils/got.cjs')
const { pause } = require('./utils/pause.cjs')
const { withSiteBuilder } = require('./utils/site-builder.cjs')

const testMatrix = [{ args: [] }, { args: ['esbuild'] }]
const testName = (title, args) => (args.length <= 0 ? title : `${title} - ${args.join(' ')}`)

const WAIT_WRITE = 3000

const test = isCI ? avaTest.serial.bind(avaTest) : avaTest

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

testMatrix.forEach(({ args }) => {
  test(testName('Updates a JavaScript function when its main file is modified', args), async (t) => {
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
          async () => t.is(await got(`http://localhost:${port}/.netlify/functions/hello`).text(), 'Hello'),
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

        const response = await got(`http://localhost:${port}/.netlify/functions/hello`).text()

        t.is(response, 'Goodbye')
      })
    })
  })

  test(testName('Updates a TypeScript function when its main file is modified', args), async (t) => {
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
            t.is(
              await got(`http://localhost:${port}/.netlify/functions/hello`).text(),
              'Modern Web Development on the JAMStack',
            ),
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

        const response = await got(`http://localhost:${port}/.netlify/functions/hello`).text()

        t.is(response, 'Modern Web Development on the Jamstack')
      })
    })
  })

  test(testName('Updates a JavaScript function when a supporting file is modified', args), async (t) => {
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
          t.is(await got(`http://localhost:${port}/.netlify/functions/hello`).text(), 'WOOF!')
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

        const response = await got(`http://localhost:${port}/.netlify/functions/hello`).text()

        t.is(response, 'WOOF WOOF!')
      })
    })
  })

  test.only(testName('Updates a TypeScript function when a supporting file is modified', args), async (t) => {
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
          t.is(
            await got(`http://localhost:${port}/.netlify/functions/hello`).text(),
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

        const response = await got(`http://localhost:${port}/.netlify/functions/hello`).text()

        t.is(response, 'Modern Web Development on the Jamstack')
      })
    })
  })

  test(testName('Adds a new JavaScript function when a function file is created', args), async (t) => {
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

          t.is(unauthenticatedResponse.statusCode, 404)
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

        t.is(response, 'Hello')
      })
    })
  })

  test(testName('Adds a new TypeScript function when a function file is created', args), async (t) => {
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

          t.is(unauthenticatedResponse.statusCode, 404)
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

        t.is(response, 'Modern Web Development on the Jamstack')
      })
    })
  })

  test(testName('Removes a function when a function file is deleted', args), async (t) => {
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
          t.is(await got(`http://localhost:${port}/.netlify/functions/hello`).text(), 'Hello')
        }, outputBuffer)

        await pause(WAIT_WRITE)

        await builder
          .withoutFile({
            path: 'functions/hello.js',
          })
          .buildAsync()

        await waitForLogMatching('Removed function hello')

        const { statusCode } = await gotCatch404(`http://localhost:${port}/.netlify/functions/hello`)

        t.is(statusCode, 404)
      })
    })
  })

  test(testName(`should pick up new function files even through debounce`, args), async (t) => {
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
        const resp = await got.get(`${server.url}/.netlify/functions/hello`)
        t.is(resp.body, 'foo')

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

        const resp2 = await got.get(`${server.url}/.netlify/functions/hello`)
        t.is(resp2.body, 'bar')
      })
    })
  })

  test(testName('Serves functions from the internal functions directory', args), async (t) => {
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
          t.is(await got(`http://localhost:${port}/.netlify/functions/hello`).text(), 'Internal')
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

        const response = await got(`http://localhost:${port}/.netlify/functions/hello`).text()

        t.is(response, 'Internal updated')
      })
    })
  })

  test(testName('User functions take precedence over internal functions', args), async (t) => {
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
          t.is(await got(`http://localhost:${port}/.netlify/functions/hello`).text(), 'User')
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

        const response = await got(`http://localhost:${port}/.netlify/functions/hello`).text()

        t.is(response, 'User updated')
      })
    })
  })

  test(testName('Serves functions with a `.mjs` extension', args), async (t) => {
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
          path: 'functions/hello.mjs',
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
          t.is(await got(`http://localhost:${port}/.netlify/functions/hello`).text(), 'Hello, world!')
        }, outputBuffer)
      })
    })
  })

  test(testName('Serves functions inside a "type=module" package', args), async (t) => {
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
          t.is(await got(`http://localhost:${port}/.netlify/functions/hello`).text(), 'hello from es module!')
        }, outputBuffer)
      })
    })
  })

  test(testName('Resembles base64 encoding of production', args), async (t) => {
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
          t.is(
            await got(`http://localhost:${port}/.netlify/functions/echoEncoding`, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            }).text(),
            'base64',
          )
        }, outputBuffer)
      })
    })
  })
})

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

          // eslint-disable-next-line import/no-dynamic-require, n/global-require
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
        t.is(await got(`http://localhost:${port}/.netlify/functions/hello?name=one`).text(), 'one')
        t.is(await got(`http://localhost:${port}/.netlify/functions/hello?name=two`).text(), 'two')
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
      try {
        await got(`http://localhost:${port}/.netlify/functions/hello`)

        t.fail()
      } catch (error) {
        t.true(error.response.body.includes(join(builder.directory, 'functions', 'hello.js')))
        t.false(error.response.body.includes(join('.netlify', 'functions-serve')))
      }
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
        const { httpMethod, path, rawQuery, rawUrl } = await got(
          `http://localhost:${port}/.netlify/functions/hello?net=lify&jam=stack`,
        ).json()

        t.is(httpMethod, 'GET')
        t.is(path, '/.netlify/functions/hello')
        t.is(rawQuery, 'net=lify&jam=stack')
        t.is(rawUrl, `http://localhost:${port}/.netlify/functions/hello?net=lify&jam=stack`)
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
          // eslint-disable-next-line n/global-require
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
        t.is(await got(`http://localhost:${port}/.netlify/functions/hello?name=one`).text(), 'one')
        t.is(await got(`http://localhost:${port}/.netlify/functions/hello?name=two`).text(), 'two')
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

      t.true(outputBuffer.some((buffer) => /.*Reloaded function hello.*/.test(buffer.toString())))
      await tryAndLogOutput(async () => {
        t.is(await got(`http://localhost:${port}/.netlify/functions/hello?name=one`).text(), 'three')
        t.is(await got(`http://localhost:${port}/.netlify/functions/hello?name=two`).text(), 'four')
      }, outputBuffer)
    })
  })
})
