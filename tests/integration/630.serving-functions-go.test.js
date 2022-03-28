const test = require('ava')
const pWaitFor = require('p-wait-for')

const { tryAndLogOutput, withDevServer } = require('./utils/dev-server')
const got = require('./utils/got')
const { createMock: createExecaMock } = require('./utils/mock-execa')
const { pause } = require('./utils/pause')
const { withSiteBuilder } = require('./utils/site-builder')

const WAIT_INTERVAL = 600
const WAIT_TIMEOUT = 3000
const WAIT_WRITE = 1000

test('Updates a Go function when a file is modified', async (t) => {
  const originalBody = 'Hello, world!'
  const updatedBody = 'Hello, Netlify!'
  const [execaMock, removeExecaMock] = await createExecaMock(`
    const { writeFileSync } = require('fs')

    let proxyCallCount = 0

    const handler = (...args) => {
      if (args[0] === 'go') {
        const binaryPath = args[1][2]

        writeFileSync(binaryPath, '')

        return {
          stderr: '',
          stdout: ''
        }
      }
      
      if (args[0].includes('local-functions-proxy')) {
        proxyCallCount++

        const response = {
          body: proxyCallCount === 1 ? '${originalBody}' : '${updatedBody}',
          statusCode: 200
        }

        return {
          stderr: '',
          stdout: JSON.stringify(response)
        }
      }
    }

    module.exports = (...args) => ({
      ...handler(...args) || {},
      stderr: { pipe: () => {} }
    })
  `)

  await withSiteBuilder('go-function-update', async (builder) => {
    try {
      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
          },
        })
        .withContentFiles([
          {
            path: 'functions/go-func/go.mod',
            content: `<mock go.mod>`,
          },
          {
            path: 'functions/go-func/go.sum',
            content: `<mock go.sum>`,
          },
          {
            path: 'functions/go-func/main.go',
            content: `<mock main.go>`,
          },
        ])
        .buildAsync()

      await withDevServer(
        {
          cwd: builder.directory,
          env: execaMock,
        },
        async ({ outputBuffer, port }) => {
          await tryAndLogOutput(async () => {
            t.is(await got(`http://localhost:${port}/.netlify/functions/go-func`).text(), originalBody)
          }, outputBuffer)

          await pause(WAIT_WRITE)

          await builder
            .withContentFile({ path: 'functions/go-func/main.go', content: `<updated mock main.go>` })
            .buildAsync()

          await tryAndLogOutput(
            () =>
              pWaitFor(
                async () => {
                  const response = await got(`http://localhost:${port}/.netlify/functions/go-func`).text()

                  return response === updatedBody
                },
                { interval: WAIT_INTERVAL, timeout: WAIT_TIMEOUT },
              ),
            outputBuffer,
          )
        },
      )
    } finally {
      await removeExecaMock()
    }
  })
})

// Reproduction test to verify the abscence/presence of a Go scheduled function
test('Detects a Go scheduled function using netlify-toml config', async (t) => {
  const [execaMock, removeExecaMock] = await createExecaMock(`
    const { writeFileSync } = require('fs')

    const handler = (...args) => {
      if (args[0].includes('local-functions-proxy')) {
        const response = {
          statusCode: 200
        }

        return {
          stderr: '',
          stdout: JSON.stringify(response)
        }
      }
    }

    module.exports = (...args) => ({
      ...handler(...args) || {},
      stderr: { pipe: () => {} }
    })
  `)

  await withSiteBuilder('go-scheduled-function', async (builder) => {
    try {
      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'src/', 'go-scheduled-function': { schedule: '@daily' } },
          },
        })
        .withContentFiles([
          {
            path: 'go.mod',
            content: `<mock go.mod>`,
          },
          {
            path: 'go.sum',
            content: `<mock go.sum>`,
          },
          {
            path: 'src/go-scheduled-function/main.go',
            content: `<mock main.go>`,
          },
        ])
        .buildAsync()

      await withDevServer(
        {
          cwd: builder.directory,
          env: execaMock,
        },
        async ({ port }) => {
          const response = await got(`http://localhost:${port}/.netlify/functions/go-scheduled-function`)

          t.regex(response.body, /You performed an HTTP request/)
          t.regex(response.body, /Your function returned `body`/)

          t.is(response.statusCode, 200)
        },
      )
    } finally {
      await removeExecaMock()
    }
  })
})
