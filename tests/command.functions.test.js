// Handlers are meant to be async outside tests
/* eslint-disable require-await */
const path = require('path')

const test = require('ava')
const execa = require('execa')
const tempDirectory = require('temp-dir')
const { v4: uuid } = require('uuid')

const fs = require('../src/lib/fs')

const cliPath = require('./utils/cli-path')
const { withDevServer } = require('./utils/dev-server')
const { handleQuestions, answerWithValue, CONFIRM } = require('./utils/handle-questions');
const { withMockApi } = require('./utils/mock-api');
const { withSiteBuilder } = require('./utils/site-builder')

test.beforeEach((t) => {
  const directory = path.join(tempDirectory, `netlify-cli-functions-create`, uuid())
  t.context.binPath = directory
})

test.afterEach(async (t) => {
  await fs.rmdirRecursiveAsync(t.context.binPath)
})

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
  const { binPath } = t.context;

  const initQuestions = [
    {
      question: 'Enter the path, relative to your site',
      answer: answerWithValue(binPath),
    },
    {
      question: 'Pick a template',
      answer: answerWithValue(CONFIRM)
    },
    {
      question: 'name your function',
      answer: answerWithValue(CONFIRM)
    }
  ]

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
    { path: 'deploy_keys', method: 'post', response: { public_key: 'public_key' } },
    { path: 'sites/site_id', method: 'patch', response: { deploy_hook: 'deploy_hook' } },
  ]

  await withSiteBuilder('site-with-no-functions-dir', async (builder) => {
    builder.withNetlifyToml({config: { build: { functions: 'functions' } }})

    await builder.buildAsync();


    await withMockApi(routes, async ({ apiUrl }) => {
      // --manual is used to avoid the config-github flow that uses GitHub API
      const childProcess = execa(cliPath, ['functions:create'], {
        env: { 
          NETLIFY_API_URL: apiUrl, 
          NETLIFY_SITE_ID: 'site_id', 
          NETLIFY_AUTH_TOKEN: 'fake-token',
          cwd: builder.directory,
        },
      })

      handleQuestions(childProcess, initQuestions)

      await childProcess

      t.is(await fs.fileExistsAsync(`${binPath}/hello-world/hello-world.js`), true)
    })
  })
})

/* eslint-enable require-await */
