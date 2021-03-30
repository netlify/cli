// Handlers are meant to be async outside tests
/* eslint-disable require-await */
const test = require('ava')
const execa = require('execa')

const fs = require('../src/lib/fs')

const cliPath = require('./utils/cli-path')
const { withDevServer } = require('./utils/dev-server')
const { handleQuestions, answerWithValue, CONFIRM } = require('./utils/handle-questions')
const { withMockApi } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')

test('should return function response when invoked', async (t) => {
  await withSiteBuilder('site-with-ping-function', async (builder) => {
    builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
      path: 'ping.js',
      handler: async () => ({
        statusCode: 200,
        body: 'ping',
      }),
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

test('should create a new function directory when none is found', async (t) => {
  const siteInfo = {
    admin_url: 'https://app.netlify.com/sites/site-name/overview',
    ssl_url: 'https://site-name.netlify.app/',
    id: 'site_id',
    name: 'site-name',
    build_settings: { repo_url: 'https://github.com/owner/repo' },
  }

  const routes = [
    {
      path: 'accounts',
      response: [{ slug: 'test-account' }],
    },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'sites/site_id', response: siteInfo },
    {
      path: 'sites',
      response: [siteInfo],
    },
    { path: 'sites/site_id', method: 'patch', response: {} },
  ]

  await withSiteBuilder('site-with-no-functions-dir', async (builder) => {
    await builder.buildAsync()

    const createFunctionQuestions = [
      {
        question: 'Enter the path, relative to your site',
        answer: answerWithValue('test/functions'),
      },
      {
        question: 'Pick a template',
        answer: answerWithValue(CONFIRM),
      },
      {
        question: 'name your function',
        answer: answerWithValue(CONFIRM),
      },
    ]

    await withMockApi(routes, async ({ apiUrl }) => {
      const childProcess = execa(cliPath, ['functions:create'], {
        env: {
          NETLIFY_API_URL: apiUrl,
          NETLIFY_SITE_ID: 'site_id',
          NETLIFY_AUTH_TOKEN: 'fake-token',
        },
        cwd: builder.directory,
      })

      handleQuestions(childProcess, createFunctionQuestions)

      await childProcess

      t.is(await fs.fileExistsAsync(`${builder.directory}/test/functions/hello-world/hello-world.js`), true)
    })
  })
})

test('should not create a new function directory when one is found', async (t) => {
  const siteInfo = {
    admin_url: 'https://app.netlify.com/sites/site-name/overview',
    ssl_url: 'https://site-name.netlify.app/',
    id: 'site_id',
    name: 'site-name',
    build_settings: { repo_url: 'https://github.com/owner/repo' },
  }

  const routes = [
    {
      path: 'accounts',
      response: [{ slug: 'test-account' }],
    },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'sites/site_id', response: siteInfo },
    {
      path: 'sites',
      response: [siteInfo],
    },
    { path: 'sites/site_id', method: 'patch', response: {} },
  ]

  await withSiteBuilder('site-with-functions-dir', async (builder) => {
    builder.withNetlifyToml({ config: { build: { functions: 'functions' } } })

    await builder.buildAsync()

    const createFunctionQuestions = [
      {
        question: 'Pick a template',
        answer: answerWithValue(CONFIRM),
      },
      {
        question: 'name your function',
        answer: answerWithValue(CONFIRM),
      },
    ]

    await withMockApi(routes, async ({ apiUrl }) => {
      const childProcess = execa(cliPath, ['functions:create'], {
        env: {
          NETLIFY_API_URL: apiUrl,
          NETLIFY_SITE_ID: 'site_id',
          NETLIFY_AUTH_TOKEN: 'fake-token',
        },
        cwd: builder.directory,
      })

      handleQuestions(childProcess, createFunctionQuestions)

      await childProcess

      t.is(await fs.fileExistsAsync(`${builder.directory}/functions/hello-world/hello-world.js`), true)
    })
  })
})

/* eslint-enable require-await */
