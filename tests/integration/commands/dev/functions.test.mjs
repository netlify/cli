import { expect, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.cjs'
import got from '../../utils/got.cjs'
import { pause } from '../../utils/pause.cjs'
import { withSiteBuilder } from '../../utils/site-builder.cjs'

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
          module.exports.handler = schedule("@daily", async (event) => {
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
          module.exports.handler = async () => {
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

          module.exports.handler = schedule("@daily", async () => {
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
      expect(warningMessage).toContain('Your function returned `body`')
    })
  })
})
