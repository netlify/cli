// Handlers are meant to be async outside tests
/* eslint-disable require-await */
const execa = require('execa')
const getPort = require('get-port')
const waitPort = require('wait-port')

const fs = require('../src/lib/fs')

const callCli = require('./utils/call-cli')
const cliPath = require('./utils/cli-path')
const { withDevServer } = require('./utils/dev-server')
const got = require('./utils/got')
const { CONFIRM, DOWN, answerWithValue, handleQuestions } = require('./utils/handle-questions')
const { withMockApi } = require('./utils/mock-api')
const { pause } = require('./utils/pause')
const { killProcess } = require('./utils/process')
const { withSiteBuilder } = require('./utils/site-builder')

// Some tests take more than 5 seconds which is the default timeout
jest.setTimeout(15_000)
jest.retryTimes(5)

test('should return function response when invoked with no identity argument', async () => {
  await withSiteBuilder('function-invoke-with-no-identity-argument', async (builder) => {
    builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
      path: 'test-invoke.js',
      handler: async () => ({
        statusCode: 200,
        body: 'success',
      }),
    })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const stdout = await callCli(['functions:invoke', 'test-invoke', `--port=${server.port}`], {
        cwd: builder.directory,
      })
      expect(stdout).toBe('success')
    })
  })
})

test('should return function response when invoked', async () => {
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
      const stdout = await callCli(['functions:invoke', 'ping', '--identity', `--port=${server.port}`], {
        cwd: builder.directory,
      })
      expect(stdout).toBe('ping')
    })
  })
})

test('should create a new function directory when none is found', async () => {
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
        question: 'Select the language of your function',
        answer: answerWithValue(CONFIRM),
      },
      {
        question: 'Pick a template',
        answer: answerWithValue(CONFIRM),
      },
      {
        question: 'Name your function',
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

      expect(await fs.fileExistsAsync(`${builder.directory}/test/functions/hello-world/hello-world.js`)).toBe(true)
    })
  })
})

test('should install function template dependencies on a site-level `package.json` if one is found', async () => {
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

  await withSiteBuilder('site-with-no-functions-dir-with-package-json', async (builder) => {
    builder.withPackageJson({
      packageJson: {
        dependencies: {
          '@netlify/functions': '^0.1.0',
        },
      },
    })

    await builder.buildAsync()

    const createFunctionQuestions = [
      {
        question: 'Enter the path, relative to your site',
        answer: answerWithValue('test/functions'),
      },
      {
        question: 'Select the language of your function',
        answer: answerWithValue(CONFIRM),
      },
      {
        question: 'Pick a template',
        answer: answerWithValue(`${DOWN}${CONFIRM}`),
      },
      {
        question: 'Name your function',
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

      // eslint-disable-next-line import/no-dynamic-require, node/global-require
      const { dependencies } = require(`${builder.directory}/package.json`)

      // NOTE: Ideally we should be running this test with a specific template,
      // but `inquirer-autocomplete-prompt` doesn't seem to work with the way
      // we're mocking prompt responses with `handleQuestions`. Instead, we're
      // choosing the second template in the list, assuming it's the first one
      // that contains a `package.json` (currently that's `apollo-graphql`).
      expect(await fs.fileExistsAsync(`${builder.directory}/test/functions/apollo-graphql/apollo-graphql.js`)).toBe(
        true,
      )
      expect(await fs.fileExistsAsync(`${builder.directory}/test/functions/apollo-graphql/package.json`)).toBe(false)
      expect(typeof dependencies['apollo-server-lambda']).toBe('string')

      expect(dependencies['@netlify/functions']).toBe('^0.1.0')
    })
  })
})

test('should install function template dependencies in the function sub-directory if no site-level `package.json` is found', async () => {
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

  await withSiteBuilder('site-with-no-functions-dir-without-package-json', async (builder) => {
    await builder.buildAsync()

    const createFunctionQuestions = [
      {
        question: 'Enter the path, relative to your site',
        answer: answerWithValue('test/functions'),
      },
      {
        question: 'Select the language of your function',
        answer: answerWithValue(CONFIRM),
      },
      {
        question: 'Pick a template',
        answer: answerWithValue(`${DOWN}${CONFIRM}`),
      },
      {
        question: 'Name your function',
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

      // NOTE: Ideally we should be running this test with a specific template,
      // but `inquirer-autocomplete-prompt` doesn't seem to work with the way
      // we're mocking prompt responses with `handleQuestions`. Instead, we're
      // choosing the second template in the list, assuming it's the first one
      // that contains a `package.json` (currently that's `apollo-graphql`).
      expect(await fs.fileExistsAsync(`${builder.directory}/test/functions/apollo-graphql/apollo-graphql.js`)).toBe(
        true,
      )
      expect(await fs.fileExistsAsync(`${builder.directory}/test/functions/apollo-graphql/package.json`)).toBe(true)
    })
  })
})

test('should not create a new function directory when one is found', async () => {
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
        question: 'Select the language of your function',
        answer: answerWithValue(CONFIRM),
      },
      {
        question: 'Pick a template',
        answer: answerWithValue(CONFIRM),
      },
      {
        question: 'Name your function',
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

      expect(await fs.fileExistsAsync(`${builder.directory}/functions/hello-world/hello-world.js`)).toBe(true)
    })
  })
})

test('should only show function templates for the language specified via the --language flag, if one is present', async () => {
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
        question: 'Name your function',
        answer: answerWithValue(CONFIRM),
      },
    ]

    await withMockApi(routes, async ({ apiUrl }) => {
      const childProcess = execa(cliPath, ['functions:create', '--language', 'javascript'], {
        env: {
          NETLIFY_API_URL: apiUrl,
          NETLIFY_SITE_ID: 'site_id',
          NETLIFY_AUTH_TOKEN: 'fake-token',
        },
        cwd: builder.directory,
      })

      handleQuestions(childProcess, createFunctionQuestions)

      await childProcess

      expect(await fs.fileExistsAsync(`${builder.directory}/test/functions/hello-world/hello-world.js`)).toBe(true)
    })
  })
})

test('throws an error when the --language flag contains an unsupported value', async () => {
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
        question: 'Name your function',
        answer: answerWithValue(CONFIRM),
      },
    ]

    await withMockApi(routes, async ({ apiUrl }) => {
      const childProcess = execa(cliPath, ['functions:create', '--language', 'coffeescript'], {
        env: {
          NETLIFY_API_URL: apiUrl,
          NETLIFY_SITE_ID: 'site_id',
          NETLIFY_AUTH_TOKEN: 'fake-token',
        },
        cwd: builder.directory,
      })

      handleQuestions(childProcess, createFunctionQuestions)

      try {
        await childProcess
      } catch (error) {
        expect(error.message.includes('Invalid language: coffeescript')).toBe(true)
      }

      expect(await fs.fileExistsAsync(`${builder.directory}/test/functions/hello-world/hello-world.js`)).toBe(false)
    })
  })
  expect.assertions(2)
})

const DEFAULT_PORT = 9999
const SERVE_TIMEOUT = 180_000

const withFunctionsServer = async ({ builder, args = [], port = DEFAULT_PORT }, testHandler) => {
  let ps
  try {
    ps = execa(cliPath, ['functions:serve', ...args], {
      cwd: builder.directory,
    })

    ps.stdout.on('data', (data) => console.log(data.toString()))
    ps.stderr.on('data', (data) => console.log(data.toString()))

    const open = await waitPort({
      port,
      output: 'silent',
      timeout: SERVE_TIMEOUT,
    })
    if (!open) {
      throw new Error('Timed out waiting for functions server')
    }
    return await testHandler()
  } finally {
    await killProcess(ps)
  }
}

test.skip('should serve functions on default port', async () => {
  await withSiteBuilder('site-with-ping-function', async (builder) => {
    await builder
      .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
      .withFunction({
        path: 'ping.js',
        handler: async () => ({
          statusCode: 200,
          body: 'ping',
        }),
      })
      .buildAsync()

    await withFunctionsServer({ builder }, async () => {
      const response = await got(`http://localhost:9999/.netlify/functions/ping`, { retry: 1 }).text()
      expect(response).toBe('ping')
    })
  })
})

test.skip('should serve functions on custom port', async () => {
  await withSiteBuilder('site-with-ping-function', async (builder) => {
    await builder
      .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
      .withFunction({
        path: 'ping.js',
        handler: async () => ({
          statusCode: 200,
          body: 'ping',
        }),
      })
      .buildAsync()

    const port = await getPort()
    await withFunctionsServer({ builder, args: ['--port', port], port }, async () => {
      const response = await got(`http://localhost:${port}/.netlify/functions/ping`).text()
      expect(response).toBe('ping')
    })
  })
})

test.skip('should use settings from netlify.toml dev', async () => {
  await withSiteBuilder('site-with-ping-function', async (builder) => {
    const port = await getPort()
    await builder
      .withNetlifyToml({
        config: { functions: { directory: 'functions' }, dev: { functions: 'other', functionsPort: port } },
      })
      .withFunction({
        pathPrefix: 'other',
        path: 'ping.js',
        handler: async () => ({
          statusCode: 200,
          body: 'ping',
        }),
      })
      .buildAsync()

    await withFunctionsServer({ builder, port }, async () => {
      const response = await got(`http://localhost:${port}/.netlify/functions/ping`).text()
      expect(response).toBe('ping')
    })
  })
})

test('should trigger background function from event', async () => {
  await withSiteBuilder('site-with-ping-function', async (builder) => {
    await builder
      .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
      .withFunction({
        path: 'identity-validate-background.js',
        handler: async (event) => ({
          statusCode: 200,
          body: JSON.stringify(event.body),
        }),
      })
      .buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const stdout = await callCli(
        ['functions:invoke', 'identity-validate-background', '--identity', `--port=${server.port}`],
        {
          cwd: builder.directory,
        },
      )
      // background functions always return an empty response
      expect(stdout).toBe('')
    })
  })
})

test('should serve helpful tips and tricks', async () => {
  await withSiteBuilder('site-with-isc-ping-function', async (builder) => {
    await builder
      .withNetlifyToml({
        config: { functions: { directory: 'functions' } },
      })
      // mocking until https://github.com/netlify/functions/pull/226 landed
      .withContentFile({
        path: 'node_modules/@netlify/functions/package.json',
        content: `{}`,
      })
      .withContentFile({
        path: 'node_modules/@netlify/functions/index.js',
        content: `
          module.exports.schedule = (schedule, handler) => handler
          `,
      })
      .withContentFile({
        path: 'functions/hello-world.js',
        content: `
          const { schedule } = require('@netlify/functions')

          module.exports.handler = schedule('@daily', () => {
            return {
              statusCode: 200,
              body: "hello world"
            }
          })
          `.trim(),
      })
      .buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const plainTextResponse = await got(`http://localhost:${server.port}/.netlify/functions/hello-world`, {
        throwHttpErrors: false,
        retry: null,
      })
      const youReturnedBodyRegex = /.*Your function returned `body`. Is this an accident\?.*/
      expect(plainTextResponse.body).toMatch(youReturnedBodyRegex)
      expect(plainTextResponse.body).toMatch(/.*You performed an HTTP request.*/)
      expect(plainTextResponse.statusCode).toBe(200)

      const htmlResponse = await got(`http://localhost:${server.port}/.netlify/functions/hello-world`, {
        throwHttpErrors: false,
        retry: null,
        headers: {
          accept: 'text/html',
        },
      })
      expect(htmlResponse.body).toMatch(/.*<link.*/)
      expect(htmlResponse.statusCode).toBe(200)

      const stdout = await callCli(['functions:invoke', 'hello-world', '--identity', `--port=${server.port}`], {
        cwd: builder.directory,
      })
      expect(stdout).toMatch(youReturnedBodyRegex)
    })
  })
})

test('should emulate next_run for scheduled functions', async () => {
  await withSiteBuilder('site-with-isc-ping-function', async (builder) => {
    await builder
      .withNetlifyToml({
        config: { functions: { directory: 'functions' } },
      })
      // mocking until https://github.com/netlify/functions/pull/226 landed
      .withContentFile({
        path: 'node_modules/@netlify/functions/package.json',
        content: `{}`,
      })
      .withContentFile({
        path: 'node_modules/@netlify/functions/index.js',
        content: `
          module.exports.schedule = (schedule, handler) => handler
          `,
      })
      .withContentFile({
        path: 'functions/hello-world.js',
        content: `
          const { schedule } = require('@netlify/functions')
          module.exports.handler = schedule("@daily", (event) => {
            const { next_run } = JSON.parse(event.body)
            return {
              statusCode: !!next_run ? 200 : 400,
            }
          })
          `.trim(),
      })
      .buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`http://localhost:${server.port}/.netlify/functions/hello-world`, {
        throwHttpErrors: false,
        retry: null,
      })

      expect(response.statusCode).toBe(200)
    })
  })
  expect.assertions(1)
})

test('should detect netlify-toml defined scheduled functions', async () => {
  await withSiteBuilder('site-with-netlify-toml-ping-function', async (builder) => {
    await builder
      .withNetlifyToml({
        config: { functions: { directory: 'functions', 'test-1': { schedule: '@daily' } } },
      })
      .withFunction({
        path: 'test-1.js',
        handler: async () => ({
          statusCode: 200,
        }),
      })
      .buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const stdout = await callCli(['functions:invoke', 'test-1', `--port=${server.port}`], {
        cwd: builder.directory,
      })
      expect(stdout).toBe('')
    })
  })
  expect.assertions(1)
})

test('should detect file changes to scheduled function', async () => {
  await withSiteBuilder('site-with-isc-ping-function', async (builder) => {
    await builder
      .withNetlifyToml({
        config: { functions: { directory: 'functions' } },
      })
      // mocking until https://github.com/netlify/functions/pull/226 landed
      .withContentFile({
        path: 'node_modules/@netlify/functions/package.json',
        content: `{}`,
      })
      .withContentFile({
        path: 'node_modules/@netlify/functions/index.js',
        content: `
          module.exports.schedule = (schedule, handler) => handler
          `,
      })
      .withContentFile({
        path: 'functions/hello-world.js',
        content: `
          module.exports.handler = () => {
            return {
              statusCode: 200
            }
          }
          `.trim(),
      })
      .buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const helloWorldBody = () =>
        got(`http://localhost:${server.port}/.netlify/functions/hello-world`, {
          throwHttpErrors: false,
          retry: null,
        }).then((response) => response.body)

      expect(await helloWorldBody()).toBe('')

      await builder
        .withContentFile({
          path: 'functions/hello-world.js',
          content: `
          const { schedule } = require('@netlify/functions')

          module.exports.handler = schedule("@daily", () => {
            return {
              statusCode: 200,
              body: "test"
            }
          })
          `.trim(),
        })
        .buildAsync()

      const DETECT_FILE_CHANGE_DELAY = 500
      await pause(DETECT_FILE_CHANGE_DELAY)

      const warningMessage = await helloWorldBody()
      expect(warningMessage.includes('Your function returned `body`')).toBe(true)
    })
  })
})

test('should inject env variables', async () => {
  await withSiteBuilder('site-with-env-function', async (builder) => {
    await builder
      .withNetlifyToml({
        config: { build: { environment: { TEST: 'FROM_CONFIG_FILE' } }, functions: { directory: 'functions' } },
      })
      .withFunction({
        path: 'echo-env.js',
        handler: async () => ({
          statusCode: 200,
          // eslint-disable-next-line node/prefer-global/process
          body: `${process.env.TEST}`,
        }),
      })
      .buildAsync()

    const port = await getPort()
    await withFunctionsServer({ builder, args: ['--port', port], port }, async () => {
      const response = await got(`http://localhost:${port}/.netlify/functions/echo-env`).text()
      expect(response).toBe('FROM_CONFIG_FILE')
    })
  })
})

/* eslint-enable require-await */
