import { version } from 'process'

import execa from 'execa'
import { gte } from 'semver'
import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'

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

const setup = async ({ fixture }) => {
  await execa('npm', ['install'], { cwd: fixture.directory })
}

describe.runIf(gte(version, '18.13.0')).concurrent('v2 api', () => {
  setupFixtureTests('dev-server-with-v2-functions', { devServer: true, mockApi: { routes }, setup }, () => {
    test<FixtureTestContext>('should successfully be able to run v2 functions', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/.netlify/functions/ping`)

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('pong')
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
      expect(['::1', '127.0.0.1'].includes(context.ip)).toBe(true)
      expect(context.geo.city).toEqual('Mock City')
      expect(context.cookies).toEqual({ foo: 'bar' })
      expect(context.account.id).toEqual('mock-account-id')
      expect(context.deploy.context).toEqual('dev')
      expect(context.deploy.id).toEqual('0')
      expect(context.deploy.published).toEqual(false)
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
      expect(await response.text()).toContain('<html lang="en">')
    })

    test<FixtureTestContext>('supports custom URLs using a literal path', async ({ devServer }) => {
      const url = `http://localhost:${devServer.port}/products`
      const response = await fetch(url)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe(`With literal path: ${url}`)
    })

    test<FixtureTestContext>("edge case: double slash isn't mistaken as protocol", async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}//something`)
      expect(response.status).toBe(404)
    })

    test<FixtureTestContext>('doesnt run form logic on paths matching function', async ({ devServer }) => {
      const url = `http://localhost:${devServer.port}/products`
      await fetch(url, { method: 'POST' })
      expect(devServer.output).not.toContain('Missing form submission function handler')
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

    test<FixtureTestContext>('supports preferStatic', async ({ devServer }) => {
      const url = `http://localhost:${devServer.port}/products/static`
      const response = await fetch(url)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe(`this is a static page\n`)
    })

    test<FixtureTestContext>('should serve the custom path ath the / route as specified in the in source config', async ({
      devServer,
    }) => {
      const url = `http://localhost:${devServer.port}/`
      const response = await fetch(url)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe(`With literal path: http://localhost:${devServer.port}/`)
    })

    test<FixtureTestContext>('catchall path applies to root path', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/`, { method: 'PATCH' })
      expect(response.status).toBe(200)
      expect(await response.text()).toBe(`Catchall Path`)
    })

    test<FixtureTestContext>('functions can also run on /favicon.ico', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/favicon.ico`)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('custom-generated favicon')
    })

    test<FixtureTestContext>('returns 404 when using the default function URL to access a function with custom routes', async ({
      devServer,
    }) => {
      const url = `http://localhost:${devServer.port}/.netlify/functions/custom-path-literal`
      const response = await fetch(url)
      expect(response.status).toBe(404)
    })

    test<FixtureTestContext>('respects excluded paths', async ({ devServer }) => {
      const url1 = `http://localhost:${devServer.port}/custom-path-excluded/t-shirt`
      const response1 = await fetch(url1)
      expect(response1.status).toBe(200)
      expect(await response1.text()).toBe(`Your product: t-shirt`)

      const url2 = `http://localhost:${devServer.port}/custom-path-excluded/jacket`
      const response2 = await fetch(url2)
      expect(response2.status).toBe(404)
    })

    describe('handles rewrites to a function', () => {
      test<FixtureTestContext>('rewrite to legacy URL format with `force: true`', async ({ devServer }) => {
        const url = `http://localhost:${devServer.port}/v2-to-legacy-with-force`
        const response = await fetch(url)
        expect(response.status).toBe(200)
        expect(await response.text()).toBe('404 Not Found')
      })

      test<FixtureTestContext>('rewrite to legacy URL format with `force: false`', async ({ devServer }) => {
        const url = `http://localhost:${devServer.port}/v2-to-legacy-without-force`
        const response = await fetch(url)
        expect(response.status).toBe(200)
        const text = await response.text()
        expect(text.trim()).toBe('/v2-to-legacy-without-force from origin')
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
        const text = await response.text()
        expect(text.trim()).toBe('/v2-to-custom-without-force from origin')
      })
    })

    test<FixtureTestContext>('has access to Netlify Blobs', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/blobs`)

      expect(response.status).toBe(200)

      const body = await response.json()

      expect(body.data).toBe('hello world')
      expect(body.metadata).toEqual({ name: 'Netlify', features: { blobs: true, functions: true } })
    })

    test<FixtureTestContext>('does not shadow Image CDN', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/.netlify/images?url=test.png&fm=avif`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/avif')
    })
  })
})
