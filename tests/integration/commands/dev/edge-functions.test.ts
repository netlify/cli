import process from 'process'
import { rename } from 'fs/promises'
import { join } from 'path'

import execa from 'execa'
import fetch from 'node-fetch'
import { describe, expect, expectTypeOf, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import { pause } from '../../utils/pause.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

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
        const response = await fetch(`http://localhost:${devServer.port}/ordertest`)
        const body = await response.text()

        expect(response.status).toBe(200)
        expect(body).toMatchSnapshot()
      })

      test<FixtureTestContext>('should provide context properties', async ({ devServer }) => {
        const response = await fetch(`http://localhost:${devServer.port}/context`)

        const { deploy, geo, ip, params, requestId, server, site } = await response.json()
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
        const response = await fetch(`http://localhost:${devServer.port}/categories/foo/products/bar`)

        const { params } = await response.json()
        expect(params).toEqual({
          category: 'foo',
          product: 'bar',
        })
      })

      test<FixtureTestContext>('should expose URL parameters to edge functions with `cache: "manual"`', async ({
        devServer,
      }) => {
        const response = await fetch(`http://localhost:${devServer.port}/categories-after-cache/foo/products/bar`)

        const { params } = await response.json()
        expect(params).toEqual({
          category: 'foo',
          product: 'bar',
        })
      })

      test<FixtureTestContext>('should respect config.methods field', async ({ devServer }) => {
        const responseGet = await fetch(`http://localhost:${devServer.port}/products/really-bad-product`, {
          method: 'GET',
        })

        expect(responseGet.status).toBe(404)

        const responseDelete = await fetch(`http://localhost:${devServer.port}/products/really-bad-product`, {
          method: 'DELETE',
        })

        expect(await responseDelete.text()).toEqual('Deleted item successfully: really-bad-product')
      })

      test<FixtureTestContext>('should show an error page when an edge function has an uncaught exception', async ({
        devServer,
      }) => {
        const [plainTextResponse, htmlResponse] = await Promise.all([
          fetch(`http://localhost:${devServer.port}/uncaught-exception`, {
            method: 'GET',
          }),
          fetch(`http://localhost:${devServer.port}/uncaught-exception`, {
            method: 'GET',
            headers: {
              Accept: 'text/html',
            },
          }),
        ])

        expect(plainTextResponse.status).toBe(500)
        expect(await plainTextResponse.text()).toContain('ReferenceError: thisWillThrow is not defined')

        expect(await htmlResponse.text()).toContain(
          '<p>An unhandled error in the function code triggered the following message:</p>',
        )
      })

      test<FixtureTestContext>('should set the `URL`, `SITE_ID`, and `SITE_NAME` environment variables', async ({
        devServer,
      }) => {
        const body = (await fetch(`http://localhost:${devServer.port}/echo-env`).then((res) => res.json())) as Record<
          string,
          string
        >

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

  test('should reload on change to transitive dependency', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'parent.js',
          content: "export { foo } from './child.js'",
        })
        .withContentFile({
          path: 'child.js',
          content: "export const foo = 'foo'",
        })
        .withContentFile({
          path: 'netlify/edge-functions/func.js',
          content: `
          import { foo } from '../../parent.js'
          export default async () => new Response(foo)
          export const config = { path: '/' }
          `,
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(server.url, {}).then((res) => res.text())
        t.expect(response).toEqual('foo')

        // update file
        await builder
          .withContentFile({
            path: 'child.js',
            content: "export const foo = 'bar'",
          })
          .build()

        await pause(500)

        const response2 = await fetch(server.url, {}).then((res) => res.text())
        t.expect(response2).toEqual('bar')
      })
    })
  })

  test('functions and edge functions should receive url-encoded search params in the same way', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'netlify/functions/func.js',
          content: `
          export default async (req) => new Response(new URL(req.url).search)
          export const config = { path: '/func' }
          `,
        })
        .withContentFile({
          path: 'netlify/edge-functions/func.js',
          content: `
          export default async (req) => new Response(new URL(req.url).search)
          export const config = { path: '/ef' }
          `,
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const funcResponse = await fetch(new URL('/func?1,2,3', server.url), {})
        const efResponse = await fetch(new URL('/ef?1,2,3', server.url), {})
        t.expect(await funcResponse.text()).toEqual('?1,2,3')
        t.expect(await efResponse.text()).toEqual('?1,2,3')
      })
    })
  })

  setupFixtureTests(
    'dev-server-with-edge-functions-and-npm-modules',
    { devServer: true, mockApi: { routes }, setup },
    () => {
      test<FixtureTestContext>('should run an edge function that uses the Blobs npm module', async ({ devServer }) => {
        const res = await fetch(`http://localhost:${devServer.port}/blobs`, {
          method: 'GET',
        })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
          data: 'hello world',
          metadata: { name: 'Netlify', features: { blobs: true, functions: true } },
        })
      })
    },
  )
})
