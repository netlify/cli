import fetch from 'node-fetch'
import { describe, test } from 'vitest'

import { tryAndLogOutput, withDevServer } from '../utils/dev-server.js'
import { createMock as createExecaMock } from '../utils/mock-execa.js'
import { withSiteBuilder } from '../utils/site-builder.js'

describe.concurrent('serve/functions-go', () => {
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

    await withSiteBuilder(t, async (builder) => {
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
          .build()

        await withDevServer(
          {
            cwd: builder.directory,
            env: typeof execaMock === 'function' ? {} : execaMock,
          },
          // eslint-disable-next-line @typescript-eslint/unbound-method
          async ({ outputBuffer, port, waitForLogMatching }) => {
            await tryAndLogOutput(async () => {
              const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/go-func`).then(
                (res) => res.text(),
              )
              t.expect(response).toEqual(originalBody)
            }, outputBuffer)

            await waitForLogMatching('Loaded function go-func', { timeout: 1000 })

            await builder
              .withContentFile({ path: 'functions/go-func/main.go', content: `<updated mock main.go>` })
              .build()

            await waitForLogMatching('Reloaded function go-func', { timeout: 1000 })

            const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/go-func`).then((res) =>
              res.text(),
            )

            t.expect(response).toEqual(updatedBody)
          },
        )
      } finally {
        if (typeof removeExecaMock === 'function') {
          await removeExecaMock()
        }
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

    await withSiteBuilder(t, async (builder) => {
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
          .build()

        await withDevServer(
          {
            cwd: builder.directory,
            env: typeof execaMock === 'function' ? {} : execaMock,
          },
          async ({ port }) => {
            const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/go-scheduled-function`)
            const responseBody = await response.text()
            t.expect(responseBody).toMatch(/You performed an HTTP request/)
            t.expect(responseBody).toMatch(/Your function returned `body`/)

            t.expect(response.status).toBe(200)
          },
        )
      } finally {
        if (typeof removeExecaMock === 'function') {
          await removeExecaMock()
        }
      }
    })
  })
})
