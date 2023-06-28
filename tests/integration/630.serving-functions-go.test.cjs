const test = require('ava')

const { tryAndLogOutput, withDevServer } = require('./utils/dev-server.cjs')
const got = require('./utils/got.cjs')
const { createMock: createExecaMock } = require('./utils/mock-execa.cjs')
const { pause } = require('./utils/pause.cjs')
const { withSiteBuilder } = require('./utils/site-builder.cjs')

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
        async ({ outputBuffer, port, waitForLogMatching }) => {
          await tryAndLogOutput(async () => {
            t.is(await got(`http://localhost:${port}/.netlify/functions/go-func`).text(), originalBody)
          }, outputBuffer)

          await pause(WAIT_WRITE)

          await builder
            .withContentFile({ path: 'functions/go-func/main.go', content: `<updated mock main.go>` })
            .buildAsync()

          await waitForLogMatching('Reloaded function go-func')

          const response = await got(`http://localhost:${port}/.netlify/functions/go-func`).text()

          t.is(response, updatedBody)
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
    const assert = require('assert')

    const handler = (...args) => {
      if (args[0].includes('local-functions-proxy')) {
        const { body } = JSON.parse(args[1][1])
        const { next_run } = JSON.parse(body)

        assert.ok(next_run)

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
