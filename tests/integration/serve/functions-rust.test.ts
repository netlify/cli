import { test } from 'vitest'

import { tryAndLogOutput, withDevServer } from '../utils/dev-server.js'
import { createMock as createExecaMock } from '../utils/mock-execa.js'
import { pause } from '../utils/pause.js'
import { withSiteBuilder } from '../utils/site-builder.js'

const WAIT_WRITE = 1000

test('Updates a Rust function when a file is modified', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    const originalBody = 'Netlify likes Rust'
    const updatedBody = 'Netlify *loves* Rust'

    const [execaMock, removeExecaMock] = await createExecaMock(`
      let proxyCallCount = 0

      const handler = (...args) => {
        if (args[0] === 'cargo') {
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
            path: 'functions/rust-func/Cargo.toml',
            content: `[package]
          name = "rust-func"`,
          },
          {
            path: 'functions/rust-func/src/main.rs',
            content: `<mock main.rs>`,
          },
        ])
        .build()

      await withDevServer(
        {
          cwd: builder.directory,
          env: {
            ...(typeof execaMock === 'function' ? {} : execaMock),
            NETLIFY_EXPERIMENTAL_BUILD_RUST_SOURCE: 'true',
          },
        },
        // eslint-disable-next-line @typescript-eslint/unbound-method
        async ({ outputBuffer, port, waitForLogMatching }) => {
          await tryAndLogOutput(async () => {
            const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/rust-func`).then(
              (res) => res.text(),
            )
            t.expect(response).toEqual(originalBody)
          }, outputBuffer)

          await pause(WAIT_WRITE)

          await builder
            .withContentFile({ path: 'functions/rust-func/src/main.rs', content: `<updated mock main.rs>` })
            .build()

          await waitForLogMatching('Reloaded function rust-func')

          const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/rust-func`).then((res) =>
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
