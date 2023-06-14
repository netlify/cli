import { version } from 'process'

import { gte } from 'semver'
import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import got from '../../utils/got.cjs'

describe.runIf(gte(version, '18.13.0'))('v2 api', () => {
  setupFixtureTests('dev-server-with-v2-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should successfully be able to run v2 functions', async ({ devServer }) => {
      const response = await got(`http://localhost:${devServer.port}/.netlify/functions/ping`, {
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(response.statusCode).toBe(200)
      expect(response.body).toBe('pong')
    })
  })
})
