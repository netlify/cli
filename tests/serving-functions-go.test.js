import test from 'ava'
import pWaitFor from 'p-wait-for'

import { tryAndLogOutput, withDevServer } from './utils/dev-server.js'
import got from './utils/got.js'
import { createMock as createExecaMock } from './utils/mock-execa.js'
import { pause } from './utils/pause.js'
import { withSiteBuilder } from './utils/site-builder.js'

import WAIT_INTERVAL = 600
const WAIT_TIMEOUT = 3000
const WAIT_WRITE = 1000

test('Updates a Go function when a file is modified', async (t) => {
  const originalBody = 'Hello, world!'
  const updatedBody = 'Hello, Netlify!'
  const [execaMock, removeExecaMock] = await createExecaMock(`
    const { writeFileSync } from 'fs'

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

    export default (...args) => ({
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
