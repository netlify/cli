const process = require('process')

const { withSiteBuilder } = require('../../tests/utils/site-builder')

const { tryLoadDotEnvFiles } = require('./dot-env')

test('should return an empty array for a site with no .env file', async () => {
  await withSiteBuilder('site-without-env-file', async (builder) => {
    await builder.buildAsync()

    const results = await tryLoadDotEnvFiles({ projectDir: builder.directory })
    expect(results).toEqual([])
  })
})

test('should read env vars from .env file', async () => {
  process.env.NODE_ENV = 'development'
  await withSiteBuilder('site-with-envs-file', async (builder) => {
    builder.withEnvFile({
      path: '.env',
      env: { TEST: 'FROM_ENV' },
    })
    await builder.buildAsync()

    const results = await tryLoadDotEnvFiles({ projectDir: builder.directory })
    expect(results).toEqual([{ file: '.env', env: { TEST: 'FROM_ENV' } }])
  })
})

test('should read env vars from .env.development file', async () => {
  process.env.NODE_ENV = 'development'
  await withSiteBuilder('site-with-envs-file', async (builder) => {
    builder.withEnvFile({
      path: '.env.development',
      env: { TEST: 'FROM_DEVELOPMENT_ENV' },
    })
    await builder.buildAsync()

    const results = await tryLoadDotEnvFiles({ projectDir: builder.directory })
    expect(results).toEqual([{ file: '.env.development', env: { TEST: 'FROM_DEVELOPMENT_ENV' } }])
  })
})

test('should read from both .env.development and .env', async () => {
  process.env.NODE_ENV = 'development'
  await withSiteBuilder('site-with-envs-file', async (builder) => {
    builder
      .withEnvFile({
        path: '.env',
        env: { ONE: 'FROM_ENV', TWO: 'FROM_ENV' },
      })
      .withEnvFile({
        path: '.env.development',
        env: { ONE: 'FROM_DEVELOPMENT_ENV', THREE: 'FROM_DEVELOPMENT_ENV' },
      })
    await builder.buildAsync()

    const results = await tryLoadDotEnvFiles({ projectDir: builder.directory })
    expect(results).toEqual([
      { file: '.env', env: { ONE: 'FROM_ENV', TWO: 'FROM_ENV' } },
      { file: '.env.development', env: { ONE: 'FROM_DEVELOPMENT_ENV', THREE: 'FROM_DEVELOPMENT_ENV' } },
    ])
  })
})

test('should handle empty .env file', async () => {
  await withSiteBuilder('site-with-empty-env-file', async (builder) => {
    builder.withEnvFile({
      path: '.env',
    })

    await builder.buildAsync()

    const results = await tryLoadDotEnvFiles({ projectDir: builder.directory })
    expect(results).toEqual([{ file: '.env', env: {} }])
  })
})
