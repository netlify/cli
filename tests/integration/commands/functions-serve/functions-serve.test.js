import execa from 'execa'
import getPort from 'get-port'
import fetch from 'node-fetch'
import { describe, test } from 'vitest'
import waitPort from 'wait-port'

import { cliPath } from '../../utils/cli-path.js'
import { killProcess } from '../../utils/process.js'
import { withSiteBuilder } from '../../utils/site-builder.ts'

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

describe.concurrent('functions:serve command', () => {
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
        const response = await fetch(`http://localhost:9999/.netlify/functions/ping`)
        t.expect(await response.text()).toEqual('ping')
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
        const response = await fetch(`http://localhost:${port}/.netlify/functions/ping`)
        t.expect(await response.text()).toEqual('ping')
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
        const response = await fetch(`http://localhost:${port}/.netlify/functions/ping`)
        t.expect(await response.text()).toEqual('ping')
      })
    })
  })

  test('should inject env variables', async (t) => {
    await withSiteBuilder('site-with-env-function', async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            build: { environment: { MY_CONFIG: 'FROM_CONFIG_FILE' } },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'echo-env.js',
          handler: async () => ({
            statusCode: 200,
            // eslint-disable-next-line n/prefer-global/process
            body: `${process.env.MY_CONFIG}`,
          }),
        })
        .buildAsync()

      const port = await getPort()
      await withFunctionsServer({ builder, args: ['--port', port], port }, async () => {
        const response = await fetch(`http://localhost:${port}/.netlify/functions/echo-env`)
        t.expect(await response.text()).toEqual('FROM_CONFIG_FILE')
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
        const response = await fetch(`http://localhost:${port}/.netlify/functions/echo-event`, {
          headers: { 'content-type': 'application/json; charset=utf-8' },
        })
        const jsonResponse = await response.json()
        t.expect(jsonResponse.isBase64Encoded).toBe(false)
      })
    })
  })

  test('should serve V2 functions', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'netlify/functions/ping.js',
          content: `
          export default () => new Response("ping")
          export const config = { path: "/ping" }
          `
        })
        .build()

      await withFunctionsServer({ builder }, async () => {
        const response = await fetch(`http://localhost:9999/ping`)
        t.expect(await response.text()).toEqual('ping')
      })
    })
  })
})
