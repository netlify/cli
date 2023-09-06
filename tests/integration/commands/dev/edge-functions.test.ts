import { describe, expect, expectTypeOf, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import got from '../../utils/got.cjs'
import { pause } from '../../utils/pause.cjs'

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

    test<FixtureTestContext>('should provide context properties', async ({ devServer }) => {
      const response = await got(`http://localhost:${devServer.port}/context`, {
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      const { deploy, geo, ip, params, requestId, server, site } = JSON.parse(response.body)
      expect(geo.city).toEqual('Mock City')
      expect(geo.country.code).toEqual('DE')
      expect(deploy).toEqual({ id: '0' })
      expectTypeOf(ip).toBeString()
      expect(params).toEqual({})
      expectTypeOf(requestId).toBeString()
      expect(server).toEqual({ region: 'local' })
      expect(site).toEqual({ id: 'foo' })
    })

    test<FixtureTestContext>('should expose URL parameters', async ({ devServer }) => {
      const response = await got(`http://localhost:${devServer.port}/categories/foo/products/bar`, {
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      const { params } = JSON.parse(response.body)
      expect(params).toEqual({
        category: 'foo',
        product: 'bar',
      })
    })

    test<FixtureTestContext>('should respect config.methods field', async ({ devServer }) => {
      const responseGet = await got(`http://localhost:${devServer.port}/products/really-bad-product`, {
        method: "GET",
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(responseGet.statusCode).toBe(404)

      const responseDelete = await got(`http://localhost:${devServer.port}/products/really-bad-product`, {
        method: "DELETE",
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(responseDelete.body).toEqual('Deleted item successfully: really-bad-product')
    })
  })

  setupFixtureTests('dev-server-with-edge-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should not remove other edge functions on change', async ({ devServer, fixture }) => {
      // we need to wait till file watchers are loaded
      await pause(500)

      await fixture.builder
        .withEdgeFunction({
          name: 'new',
          handler: async (_, context) => new Response('hello'),
          config: { path: ['/new'] },
        })
        .build()

      await devServer.waitForLogMatching('Loaded edge function new')

      expect(devServer.output).not.toContain('Removed edge function')
    })
  })
})
