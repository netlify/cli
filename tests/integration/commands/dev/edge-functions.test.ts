import process from 'process'
import { rename } from 'fs/promises'
import { join } from 'path'

import execa from 'execa'
import { describe, expect, expectTypeOf, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import got from '../../utils/got.js'
import { pause } from '../../utils/pause.js'

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

const setup = async ({ fixture }: FixtureTestContext) => {
  await execa('npm', ['install'], { cwd: fixture.directory })
}

const recreateEdgeFunctions = async ({ fixture }: FixtureTestContext) => {
  await rename(
    join(fixture.directory, '.netlify', '_edge-functions'),
    join(fixture.directory, '.netlify', 'edge-functions'),
  )
}

describe.skipIf(isWindows)('edge functions', () => {
  setupFixtureTests(
    'dev-server-with-edge-functions',
    { devServer: true, mockApi: { routes }, setupAfterDev: recreateEdgeFunctions },
    () => {
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
        expect(site).toEqual({ id: 'foo', name: 'site-name', url: `http://localhost:${devServer.port}` })
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

      test<FixtureTestContext>('should expose URL parameters to edge functions with `cache: "manual"`', async ({
        devServer,
      }) => {
        const response = await got(`http://localhost:${devServer.port}/categories-after-cache/foo/products/bar`, {
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

      test<FixtureTestContext>('should set the `URL`, `SITE_ID`, and `SITE_NAME` environment variables', async ({
        devServer,
      }) => {
        const body = (await got(`http://localhost:${devServer.port}/echo-env`, {
          throwHttpErrors: false,
          retry: { limit: 0 },
        }).json()) as Record<string, string>

        expect(body.SITE_ID).toBe('foo')
        expect(body.SITE_NAME).toBe('site-name')
        expect(body.URL).toBe(`http://localhost:${devServer.port}`)
      })
    },
  )

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

  setupFixtureTests(
    'dev-server-with-edge-functions-and-npm-modules',
    { devServer: true, mockApi: { routes }, setup },
    () => {
      test<FixtureTestContext>('should run an edge function that uses the Blobs npm module', async ({ devServer }) => {
        const res = await got(`http://localhost:${devServer.port}/blobs`, {
          method: 'GET',
          throwHttpErrors: false,
          retry: { limit: 0 },
        })

        expect(res.statusCode).toBe(200)
        expect(JSON.parse(res.body)).toEqual({
          data: 'hello world',
          metadata: { name: 'Netlify', features: { blobs: true, functions: true } },
        })
      })
    },
  )
})
