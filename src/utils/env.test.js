const test = require('ava')
const path = require('path')
const { getEnvSettings } = require('./env')
const { withSiteBuilder } = require('../../tests/utils/siteBuilder')

test('should return empty object for a site with no .env file', async t => {
  await withSiteBuilder('site-without-env-file', async builder => {
    await builder.buildAsync()

    const vars = await getEnvSettings(builder.directory)
    t.deepEqual(vars, {})
  })
})

test('should read env vars from .env.development file', async t => {
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
      file: path.resolve(builder.directory, '.env.development'),
      vars: {
        TEST: 'FROM_DEVELOPMENT_ENV',
      },
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
      file: path.resolve(builder.directory, '.env'),
      vars: {},
    })
  })
})
