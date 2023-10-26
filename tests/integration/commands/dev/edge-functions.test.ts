import process from 'process'

import { describe, expect, expectTypeOf, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import got from '../../utils/got.mjs'
import { pause } from '../../utils/pause.cjs'

// Skipping tests on Windows because of an issue with the Deno CLI throwing IO
// errors when running in the CI.
const isWindows = process.platform === 'win32'

const siteInfo = {
  account_slug: 'test-account',
  id: 'foo',
  name: 'site-name',
  feature_flags: {
    edge_functions_npm_support: true,
  },
  functions_config: { timeout: 1 },
}

const routes = [
  { path: 'sites/foo', response: siteInfo },

  { path: 'sites/foo/service-instances', response: [] },
  {
    path: 'accounts',
    response: [{ slug: siteInfo.account_slug }],
  },
]

describe.skipIf(isWindows)('edge functions', () => {
  setupFixtureTests('dev-server-with-edge-functions', { devServer: true, mockApi: { routes } }, () => {
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
      expect(site).toEqual({ id: 'foo', name: 'site-name' })
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
        method: 'GET',
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(responseGet.statusCode).toBe(404)

      const responseDelete = await got(`http://localhost:${devServer.port}/products/really-bad-product`, {
        method: 'DELETE',
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(responseDelete.body).toEqual('Deleted item successfully: really-bad-product')
    })

    test<FixtureTestContext>('should show an error page when an edge function has an uncaught exception', async ({
      devServer,
    }) => {
      // Request #1: Plain text
      const res1 = await got(`http://localhost:${devServer.port}/uncaught-exception`, {
        method: 'GET',
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(res1.statusCode).toBe(500)
      expect(res1.body).toContain('ReferenceError: thisWillThrow is not defined')

      // Request #2: HTML
      const res2 = await got(`http://localhost:${devServer.port}/uncaught-exception`, {
        method: 'GET',
        headers: {
          Accept: 'text/html',
        },
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(res2.body).toContain('<p>An unhandled error in the function code triggered the following message:</p>')
    })

    test<FixtureTestContext>('should run an edge function that imports an npm module', async ({ devServer }) => {
      const res = await got(`http://localhost:${devServer.port}/with-npm-module`, {
        method: 'GET',
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(res.statusCode).toBe(200)
      expect(res.body).toBe('Hello from an npm module!')
    })
  })

  setupFixtureTests('dev-server-with-edge-functions', { devServer: true, mockApi: { routes } }, () => {
    test<FixtureTestContext>('should not remove other edge functions on change', async ({ devServer, fixture }) => {
      // we need to wait till file watchers are loaded
      await pause(500)

      await fixture.builder
        .withEdgeFunction({
          name: 'new',
          handler: async () => new Response('hello'),
          config: { path: ['/new'] },
        })
        .build()

      await devServer.waitForLogMatching('Loaded edge function new')

      expect(devServer.output).not.toContain('Removed edge function')
    })
  })
})
