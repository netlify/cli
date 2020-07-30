const test = require('ava')
const cliPath = require('./utils/cliPath')
const { withDevServer } = require('./utils/devServer')
const execa = require('execa')
const { withSiteBuilder } = require('./utils/siteBuilder')

test('should return function response when invoked', async t => {
  await withSiteBuilder('site-with-ping-function', async builder => {
    builder.withNetlifyToml({ config: { build: { functions: 'functions' } } }).withFunction({
      path: 'ping.js',
      handler: async (event, context) => {
        return {
          statusCode: 200,
          body: 'ping',
        }
      },
    })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async server => {
      const { stdout } = await execa(cliPath, ['functions:invoke', 'ping', '--identity', '--port=' + server.port], {
        cwd: builder.directory,
      })

      t.is(stdout, 'ping')
    })
  })
})
