/* eslint-disable require-await */
const process = require('process')

// eslint-disable-next-line ava/use-test
const avaTest = require('ava')

const { withDevServer } = require('./utils/dev-server')
const got = require('./utils/got')
const { withSiteBuilder } = require('./utils/site-builder')

const test = process.env.CI === 'true' ? avaTest.serial.bind(avaTest) : avaTest
const testMatrix = [{ args: [] }, { args: ['esbuild'] }]
const testName = (title, args) => (args.length <= 0 ? title : `${title} - ${args.join(' ')}`)

// This needs to be high enough that the debounced file watcher events have
// time to be dispatched and executed.
const UPDATE_WAIT = 1500

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
  test(testName('Updates a function when its main file is modified', args), async (t) => {
    await withSiteBuilder('function-update-main-file', async (builder) => {
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

      await withDevServer({ cwd: builder.directory, args }, async ({ port }) => {
        t.is(await got(`http://localhost:${port}/.netlify/functions/hello`).text(), 'Hello')

        await builder
          .withFunction({
            path: 'hello.js',
            handler: async () => ({
              statusCode: 200,
              body: 'Goodbye',
            }),
          })
          .buildAsync()

        await new Promise((resolve) => {
          setTimeout(resolve, UPDATE_WAIT)
        })

        t.is(await got(`http://localhost:${port}/.netlify/functions/hello`).text(), 'Goodbye')
      })
    })
  })

  test(testName('Updates a function when a supporting file is modified', args), async (t) => {
    await withSiteBuilder('function-update-supporting-file', async (builder) => {
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

      await withDevServer({ cwd: builder.directory, args }, async ({ port }) => {
        t.is(await got(`http://localhost:${port}/.netlify/functions/hello`).text(), 'WOOF!')

        await builder
          .withContentFile({ path: 'functions/lib/util.js', content: `exports.bark = () => 'WOOF WOOF!'` })
          .buildAsync()

        await new Promise((resolve) => {
          setTimeout(resolve, UPDATE_WAIT)
        })

        t.is(await got(`http://localhost:${port}/.netlify/functions/hello`).text(), 'WOOF WOOF!')
      })
    })
  })

  test(testName('Adds a new function when a function file is created', args), async (t) => {
    await withSiteBuilder('function-create-function-file', async (builder) => {
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

      await withDevServer({ cwd: builder.directory, args }, async ({ port }) => {
        const unauthenticatedResponse = await gotCatch404(`http://localhost:${port}/.netlify/functions/hello`)

        t.is(unauthenticatedResponse.statusCode, 404)

        await builder
          .withFunction({
            path: 'hello.js',
            handler: async () => ({
              statusCode: 200,
              body: 'Hello',
            }),
          })
          .buildAsync()

        await new Promise((resolve) => {
          setTimeout(resolve, UPDATE_WAIT)
        })

        t.is(await got(`http://localhost:${port}/.netlify/functions/hello`).text(), 'Hello')
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

      await withDevServer({ cwd: builder.directory, args }, async ({ port }) => {
        t.is(await got(`http://localhost:${port}/.netlify/functions/hello`).text(), 'Hello')

        await builder
          .withoutFile({
            path: 'functions/hello.js',
          })
          .buildAsync()

        await new Promise((resolve) => {
          setTimeout(resolve, UPDATE_WAIT)
        })

        const unauthenticatedResponse = await gotCatch404(`http://localhost:${port}/.netlify/functions/hello`)

        t.is(unauthenticatedResponse.statusCode, 404)
      })
    })
  })
})
/* eslint-enable require-await */
