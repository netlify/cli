const test = require('ava')
const pWaitFor = require('p-wait-for')

const { tryAndLogOutput, withDevServer } = require('./utils/dev-server.cjs')
const got = require('./utils/got.cjs')
const { createMock: createExecaMock } = require('./utils/mock-execa.cjs')
const { pause } = require('./utils/pause.cjs')
const { withSiteBuilder } = require('./utils/site-builder.cjs')

const WAIT_INTERVAL = 600
const WAIT_TIMEOUT = 3000
const WAIT_WRITE = 1000

test('Updates a Rust function when a file is modified', async (t) => {
  await withSiteBuilder('rust-function-update', async (builder) => {
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
        .buildAsync()

      await withDevServer(
        {
          cwd: builder.directory,
          env: { ...execaMock, NETLIFY_EXPERIMENTAL_BUILD_RUST_SOURCE: 'true' },
        },
        async ({ outputBuffer, port }) => {
          await tryAndLogOutput(async () => {
            t.is(await got(`http://localhost:${port}/.netlify/functions/rust-func`).text(), originalBody)
          }, outputBuffer)

          await pause(WAIT_WRITE)

          await builder
            .withContentFile({ path: 'functions/rust-func/src/main.rs', content: `<updated mock main.rs>` })
            .buildAsync()

          await tryAndLogOutput(
            () =>
              pWaitFor(
                async () => {
                  const response = await got(`http://localhost:${port}/.netlify/functions/rust-func`).text()

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
