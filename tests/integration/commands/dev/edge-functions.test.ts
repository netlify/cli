import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import got from '../../utils/got.cjs'

describe('edge functions', () => {
  setupFixtureTests('dev-server-with-edge-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should run edge functions in correct order', async ({ devServer }) => {
      const response = await got(`http://localhost:${devServer.port}/ordertest`, {
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(response.statusCode).toBe(200)
      expect(response.body).toMatchSnapshot()
    })
  })
})
