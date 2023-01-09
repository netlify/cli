import { describe, expect, test } from 'vitest'

import callCli from '../../utils/call-cli.cjs'
import { withDevServer } from '../../utils/dev-server.cjs'
import got from '../../utils/got.cjs'
import { withSiteBuilder } from '../../utils/site-builder.cjs'

describe('functions:invoke command', () => {
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
          content: `module.exports.schedule = (schedule, handler) => handler`,
        })
        .withContentFile({
          path: 'functions/hello-world.js',
          content: `
          const { schedule } = require('@netlify/functions')

          module.exports.handler = schedule('@daily', async () => {
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
  })
})
