// Handlers are meant to be async outside tests
import { test } from 'vitest'

import { isCI } from 'ci-info'
import execa from 'execa'
import getPort from 'get-port'
import waitPort from 'wait-port'

import cliPath from './utils/cli-path.cjs'
import got from './utils/got.cjs'
import { killProcess } from './utils/process.cjs'
import { withSiteBuilder } from './utils/site-builder.cjs'

// FIXME: Run tests serial
// const test = isCI ? avaTest.serial.bind(avaTest) : avaTest

const DEFAULT_PORT = 9999
const SERVE_TIMEOUT = 180_000

const withFunctionsServer = async ({ args = [], builder, port = DEFAULT_PORT }, testHandler) => {
  let ps
  try {
    ps = execa(cliPath, ['functions:serve', ...args], {
      cwd: builder.directory,
    })

    ps.stdout.on('data', (data) => console.log(data.toString()))
    ps.stderr.on('data', (data) => console.log(data.toString()))

    const { open } = await waitPort({
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

test('should serve functions on default port', async (t) => {
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
      const response = await got(`http://localhost:9999/.netlify/functions/ping`, { retry: { limit: 1 } }).text()
      t.expect(response).toEqual('ping')
    })
  })
})

test('should serve functions on custom port', async (t) => {
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
      t.expect(response).toEqual('ping')
    })
  })
})

test('should use settings from netlify.toml dev', async (t) => {
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
      t.expect(response).toEqual('ping')
    })
  })
})

// FIXME: When migrating from ava to vitest tests stops working and returns assertion as true
test.skip('should inject env variables', async (t) => {
  await withSiteBuilder('site-with-env-function', async (builder) => {
    await builder
      .withNetlifyToml({
        config: { build: { environment: { TEST: 'FROM_CONFIG_FILE' } }, functions: { directory: 'functions' } },
      })
      .withFunction({
        path: 'echo-env.js',
        handler: async () => ({
          statusCode: 200,
          // eslint-disable-next-line n/prefer-global/process
          body: `${process.env.TEST}`,
        }),
      })
      .buildAsync()

    const port = await getPort()
    await withFunctionsServer({ builder, args: ['--port', port], port }, async () => {
      const response = await got(`http://localhost:${port}/.netlify/functions/echo-env`).text()
      t.expect(response).toEqual('FROM_CONFIG_FILE')
    })
  })
})

test('should handle content-types with charset', async (t) => {
  await withSiteBuilder('site-with-env-function', async (builder) => {
    await builder
      .withNetlifyToml({
        config: { functions: { directory: 'functions' } },
      })
      .withFunction({
        path: 'echo-event.js',
        handler: async (event) => ({
          statusCode: 200,
          body: JSON.stringify(event),
        }),
      })
      .buildAsync()

    const port = await getPort()
    await withFunctionsServer({ builder, args: ['--port', port], port }, async () => {
      const response = await got(`http://localhost:${port}/.netlify/functions/echo-event`, {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }).json()
      t.expect(response.isBase64Encoded).toBe(false)
    })
  })
})
