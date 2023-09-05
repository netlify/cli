import { version } from 'process'

import { gte } from 'semver'
import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import got from '../../utils/got.cjs'

const siteInfo = {
  account_id: 'mock-account-id',
  account_slug: 'mock-account',
  id: 'mock-site-id',
  name: 'mock-site-name',
}
const routes = [
  { path: 'sites/*/service-instances', response: [] },
  { path: 'sites/*', response: siteInfo },
  {
    path: 'accounts',
    response: [{ id: siteInfo.account_id, slug: siteInfo.account_slug }],
  },
]

describe.runIf(gte(version, '18.13.0'))('v2 api', () => {
  setupFixtureTests('dev-server-with-v2-functions', { devServer: true, mockApi: { routes } }, () => {
    test<FixtureTestContext>('should successfully be able to run v2 functions', async ({ devServer }) => {
      const response = await got(`http://localhost:${devServer.port}/.netlify/functions/ping`, {
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(response.statusCode).toBe(200)
      expect(response.body).toBe('pong')
    })

    test<FixtureTestContext>('supports streamed responses', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/.netlify/functions/stream`)

      expect(response.status).toBe(200)

      const reader = response.body!.getReader()

      const firstChunk = await reader.read()
      expect(new TextDecoder().decode(firstChunk.value)).toBe('first chunk')
      expect(firstChunk.done).toBeFalsy()

      const secondChunk = await reader.read()
      expect(new TextDecoder().decode(secondChunk.value)).toBe('second chunk')
      expect(secondChunk.done).toBeFalsy()

      const thirdChunk = await reader.read()
      expect(thirdChunk.done).toBeTruthy()
    })

    test<FixtureTestContext>('receives context', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/.netlify/functions/context`, {
        headers: {
          Cookie: 'foo=bar;',
        },
      })

      expect(response.status).toBe(200)

      const context = await response.json()
      expect(context.requestId).toEqual(response.headers.get('x-nf-request-id'))
      expect(context.site.url).toEqual(`http://localhost:${devServer.port}`)
      expect(context.server.region).toEqual('dev')
      expect(context.ip).toEqual('::1')
      expect(context.geo.city).toEqual('Mock City')

      expect(context.cookies).toEqual({ foo: 'bar' })

      expect(context.account.id).toEqual('mock-account-id')
    })

    test<FixtureTestContext>('logging works', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/.netlify/functions/log`)
      expect(response.status).toBe(200)
      expect(devServer.outputBuffer.map((buffer) => buffer.toString())).toContain('🪵🪵🪵\n')
    })

    test<FixtureTestContext>('brotli encoding works', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/.netlify/functions/brotli`)

      expect(response.status).toBe(200)
      expect(await response.text()).toBe("What's 🍞🏄‍♀️? A breadboard!".repeat(100))
    })

    test<FixtureTestContext>('basic typescript function works', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/.netlify/functions/ping-ts`)

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('pong')
    })

    test<FixtureTestContext>('shows netlify-branded error screen', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/.netlify/functions/uncaught-exception`, {
        headers: {
          Accept: 'text/html',
        },
      })

      expect(response.status).toBe(500)
      expect(response.headers.get('content-type')).toBe('text/html')
      expect(await response.text()).toContain('<html>')
    })

    test<FixtureTestContext>('supports custom URLs using a literal path', async ({ devServer }) => {
      const url = `http://localhost:${devServer.port}/products`
      const response = await fetch(url)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe(`With literal path: ${url}`)
    })

    test<FixtureTestContext>('supports custom URLs with method matching', async ({ devServer }) => {
      const url = `http://localhost:${devServer.port}/products/really-bad-product`
      const response = await fetch(url, { method: 'DELETE' })
      expect(response.status).toBe(200)
      expect(await response.text()).toBe(`Deleted item successfully: really-bad-product`)
    })

    test<FixtureTestContext>('supports custom URLs using an expression path', async ({ devServer }) => {
      const url = `http://localhost:${devServer.port}/products/netlify`
      const response = await fetch(url)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe(`With expression path: {"sku":"netlify"}`)
    })

    describe('handles rewrites to a function', () => {
      test<FixtureTestContext>('rewrite to legacy URL format with `force: true`', async ({ devServer }) => {
        const url = `http://localhost:${devServer.port}/v2-to-legacy-with-force`
        const response = await fetch(url)
        expect(response.status).toBe(200)
        expect(await response.text()).toBe(`With literal path: ${url}`)
      })

      test<FixtureTestContext>('rewrite to legacy URL format with `force: false`', async ({ devServer }) => {
        const url = `http://localhost:${devServer.port}/v2-to-legacy-without-force`
        const response = await fetch(url)
        expect(response.status).toBe(200)
        expect(await response.text()).toBe('/v2-to-legacy-without-force from origin')
      })

      test<FixtureTestContext>('rewrite to custom URL format with `force: true`', async ({ devServer }) => {
        const url = `http://localhost:${devServer.port}/v2-to-custom-with-force`
        const response = await fetch(url)
        expect(response.status).toBe(200)
        expect(await response.text()).toBe(`With literal path: ${url}`)
      })

      test<FixtureTestContext>('rewrite to custom URL format with `force: false`', async ({ devServer }) => {
        const url = `http://localhost:${devServer.port}/v2-to-custom-without-force`
        const response = await fetch(url)
        expect(response.status).toBe(200)
        expect(await response.text()).toBe('/v2-to-custom-without-force from origin')
      })
    })
  })
})
