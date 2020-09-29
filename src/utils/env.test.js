const test = require('ava')
const path = require('path')
const { getEnvSettings } = require('./env')
const { withSiteBuilder } = require('../../tests/utils/siteBuilder')

test('should return an object with empty files, vars arrays for a site with no .env file', async t => {
  await withSiteBuilder('site-without-env-file', async builder => {
    await builder.buildAsync()

    const vars = await getEnvSettings(builder.directory)
    t.deepEqual(vars, { files: [], vars: [] })
  })
})

test('should read env vars from .env.development file', async t => {
  process.env.NODE_ENV = 'development'
  await withSiteBuilder('site-with-envs-file', async builder => {
    builder
      .withEnvFile({
        path: '.env',
        env: { TEST: 'FROM_ENV' },
      })
      .withEnvFile({
        path: '.env.development',
        env: { TEST: 'FROM_DEVELOPMENT_ENV' },
      })
    await builder.buildAsync()

    const vars = await getEnvSettings(builder.directory)
    t.deepEqual(vars, {
      files: [path.resolve(builder.directory, '.env.development'), path.resolve(builder.directory, '.env')],
      vars: [['TEST', 'FROM_DEVELOPMENT_ENV']],
    })
  })
})

test('should handle empty .env file', async t => {
  await withSiteBuilder('site-with-empty-env-file', async builder => {
    builder.withEnvFile({
      path: '.env',
    })

    await builder.buildAsync()

    const vars = await getEnvSettings(builder.directory)
    t.deepEqual(vars, {
      files: [path.resolve(builder.directory, '.env')],
      vars: [],
    })
  })
})
