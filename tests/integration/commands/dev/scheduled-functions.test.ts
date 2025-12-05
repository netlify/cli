import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import fetch from 'node-fetch'

describe('scheduled functions', async () => {
  await setupFixtureTests('dev-server-with-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should emulate next_run for scheduled functions', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer!.port}/.netlify/functions/scheduled-v2`, {})

      expect(response.status).toBe(200)
    })
  })

  await setupFixtureTests('dev-server-with-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should detect file changes to scheduled function', async ({ devServer, fixture }) => {
      const body = await fetch(`http://localhost:${devServer!.port}/.netlify/functions/ping`, {}).then((res) =>
        res.text(),
      )

      expect(body).toBe('ping')

      await fixture.builder
        .withContentFile({
          path: 'functions/ping.js',
          content: `
          const { schedule } = require('@netlify/functions')

          module.exports.handler = schedule("@daily", async () => {
            return {
              statusCode: 200,
              body: "test"
            }
          })`,
        })
        .build()

      await devServer!.waitForLogMatching('Reloaded function ping', { timeout: 500 })

      const warning = await fetch(`http://localhost:${devServer!.port}/.netlify/functions/ping`, {}).then((res) =>
        res.text(),
      )

      expect(warning).toContain('Your function returned `body`')
    })
  })
})
