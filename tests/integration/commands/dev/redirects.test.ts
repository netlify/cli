import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import fetch from 'node-fetch'

describe('redirects', () => {
  setupFixtureTests('dev-server-with-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should send original query params to functions', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/with-params?param2=world&other=1`, {})

      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result.queryStringParameters).not.toHaveProperty('param1')
      expect(result.queryStringParameters).toHaveProperty('param2', 'world')
      expect(result.queryStringParameters).toHaveProperty('other', '1')
    })

    test<FixtureTestContext>('should send original query params to functions when using duplicate parameters', async ({
      devServer,
    }) => {
      const response = await fetch(`http://localhost:${devServer.port}/api/echo?param=hello&param=world`, {})

      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result.queryStringParameters).toHaveProperty('param', 'hello, world')
      expect(result.multiValueQueryStringParameters).toHaveProperty('param', ['hello', 'world'])
    })
  })

  setupFixtureTests('next-app', { devServer: true }, () => {
    test<FixtureTestContext>('should prefer local files instead of redirect when not forced', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/test.txt`, {})

      expect(response.status).toBe(200)

      const result = await response.text()
      expect(result.trim()).toEqual('hello world')
    })

    test<FixtureTestContext>('should check for the dynamic page existence before doing redirect', async ({
      devServer,
    }) => {
      const response = await fetch(`http://localhost:${devServer.port}/`, {})

      expect(response.status).toBe(200)

      const result = await response.text()
      expect(result.toLowerCase()).not.toContain('netlify')
    })
  })
})
