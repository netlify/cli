import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import got from '../../utils/got.mjs'

describe('redirects', () => {
  setupFixtureTests('dev-server-with-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should send original query params to functions', async ({ devServer }) => {
      const response = await got(`http://localhost:${devServer.port}/with-params?param2=world&other=1`, {
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(response.statusCode).toBe(200)

      const result = JSON.parse(response.body)
      expect(result.queryStringParameters).not.toHaveProperty('param1')
      expect(result.queryStringParameters).toHaveProperty('param2', 'world')
      expect(result.queryStringParameters).toHaveProperty('other', '1')
    })

    test<FixtureTestContext>('should send original query params to functions when using duplicate parameters', async ({
      devServer,
    }) => {
      const response = await got(`http://localhost:${devServer.port}/api/echo?param=hello&param=world`, {
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(response.statusCode).toBe(200)

      const result = JSON.parse(response.body)
      expect(result.queryStringParameters).toHaveProperty('param', 'hello, world')
      expect(result.multiValueQueryStringParameters).toHaveProperty('param', ['hello', 'world'])
    })
  })
})
