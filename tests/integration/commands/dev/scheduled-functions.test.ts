import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import fetch from 'node-fetch'
import { pause } from '../../utils/pause.js'

describe('scheduled functions', () => {
  setupFixtureTests('dev-server-with-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should emulate next_run for scheduled functions', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/.netlify/functions/scheduled-v2`, {})

      expect(response.status).toBe(200)
    })
  })

  setupFixtureTests('dev-server-with-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should detect file changes to scheduled function', async ({ devServer, fixture }) => {
      const body = await fetch(`http://localhost:${devServer.port}/.netlify/functions/ping`, {}).then((res) =>
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

      const DETECT_FILE_CHANGE_DELAY = 500
      await pause(DETECT_FILE_CHANGE_DELAY)

      const warning = await fetch(`http://localhost:${devServer.port}/.netlify/functions/ping`, {}).then((res) =>
        res.text(),
      )

      expect(warning).toContain('Your function returned `body`')
    })
  })
})
