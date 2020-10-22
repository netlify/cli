const test = require('ava')
const sinon = require('sinon')

const { withSiteBuilder } = require('../../tests/utils/site-builder')

const { getEnvSettings } = require('./env')

const warn = sinon.stub()

test('should return an object with empty files, vars arrays for a site with no .env file', async (t) => {
  await withSiteBuilder('site-without-env-file', async (builder) => {
    await builder.buildAsync()

    const vars = await getEnvSettings({ projectDir: builder.directory, warn })
    t.deepEqual(vars, { files: [], vars: [] })
  })
})

test('should read env vars from .env file', async (t) => {
  process.env.NODE_ENV = 'development'
  await withSiteBuilder('site-with-envs-file', async (builder) => {
    builder.withEnvFile({
      path: '.env',
      env: { TEST: 'FROM_ENV' },
    })
    await builder.buildAsync()

    const vars = await getEnvSettings({ projectDir: builder.directory, warn })
    t.deepEqual(vars, {
      files: ['.env'],
      vars: [['TEST', 'FROM_ENV']],
    })
  })
})

test('should read env vars from .env.development file', async (t) => {
  process.env.NODE_ENV = 'development'
  await withSiteBuilder('site-with-envs-file', async (builder) => {
    builder.withEnvFile({
      path: '.env.development',
      env: { TEST: 'FROM_DEVELOPMENT_ENV' },
    })
    await builder.buildAsync()

    const vars = await getEnvSettings({ projectDir: builder.directory, warn })
    t.deepEqual(vars, {
      files: ['.env.development'],
      vars: [['TEST', 'FROM_DEVELOPMENT_ENV']],
    })
  })
})

test('should merge .env.development with .env', async (t) => {
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

    const vars = await getEnvSettings({ projectDir: builder.directory, warn })
    t.deepEqual(vars, {
      files: ['.env.development', '.env'],
      vars: [
        ['ONE', 'FROM_DEVELOPMENT_ENV'],
        ['TWO', 'FROM_ENV'],
        ['THREE', 'FROM_DEVELOPMENT_ENV'],
      ],
    })
  })
})

test('should handle empty .env file', async (t) => {
  await withSiteBuilder('site-with-empty-env-file', async (builder) => {
    builder.withEnvFile({
      path: '.env',
    })

    await builder.buildAsync()

    const vars = await getEnvSettings({ projectDir: builder.directory, warn })
    t.deepEqual(vars, {
      files: ['.env'],
      vars: [],
    })
  })
})

test('should filter process.env vars', async (t) => {
  await withSiteBuilder('site-with-empty-env-file', async (builder) => {
    builder.withEnvFile({
      path: '.env',
      env: { SHOULD_FILTER: 'FROM_ENV', OTHER: 'FROM_ENV' },
    })

    await builder.buildAsync()

    process.env.SHOULD_FILTER = 'FROM_PROCESS_ENV'
    const vars = await getEnvSettings({ projectDir: builder.directory, warn })
    t.deepEqual(vars, {
      files: ['.env'],
      vars: [['OTHER', 'FROM_ENV']],
    })
  })
})
