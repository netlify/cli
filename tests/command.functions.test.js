// Handlers are meant to be async outside tests
/* eslint-disable require-await */
const test = require('ava')
const cliPath = require('./utils/cli-path')
const { withDevServer } = require('./utils/dev-server')
const execa = require('execa')
const { withSiteBuilder } = require('./utils/site-builder')

test('should return function response when invoked', async (t) => {
  await withSiteBuilder('site-with-ping-function', async (builder) => {
    builder.withNetlifyToml({ config: { build: { functions: 'functions' } } }).withFunction({
      path: 'ping.js',
      handler: async () => {
        return {
          statusCode: 200,
          body: 'ping',
        }
      },
    })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const { stdout } = await execa(cliPath, ['functions:invoke', 'ping', '--identity', `--port=${server.port}`], {
        cwd: builder.directory,
      })

      t.is(stdout, 'ping')
    })
  })
})
/* eslint-enable require-await */
