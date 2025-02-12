import fetch from 'node-fetch'
import { describe, expect, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

describe('redirects', () => {
  setupFixtureTests('dev-server-with-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should send original query params to functions', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/with-params?param2=world&other=1`)

      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result.queryStringParameters).not.toHaveProperty('param1')
      expect(result.queryStringParameters).toHaveProperty('param2', 'world')
      expect(result.queryStringParameters).toHaveProperty('other', '1')
    })

    test<FixtureTestContext>('should send original query params to functions when using duplicate parameters', async ({
      devServer,
    }) => {
      const response = await fetch(`http://localhost:${devServer.port}/api/echo?param=hello&param=world`)

      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result.queryStringParameters).toHaveProperty('param', 'hello, world')
      expect(result.multiValueQueryStringParameters).toHaveProperty('param', ['hello', 'world'])
    })
  })

  setupFixtureTests('next-app', { devServer: { env: { NETLIFY_DEV_SERVER_CHECK_SSG_ENDPOINTS: 1 } } }, () => {
    test<FixtureTestContext>('should prefer local files instead of redirect when not forced', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/test.txt`)

      expect(response.status).toBe(200)

      const result = await response.text()
      expect(result.trim()).toEqual('hello world')
      expect(devServer?.output).not.toContain('Proxying to https://www.netlify.app')
    })

    test<FixtureTestContext>('should check for the dynamic page existence before doing redirect', async ({
      devServer,
    }) => {
      const response = await fetch(`http://localhost:${devServer.port}/`)

      expect(response.status).toBe(200)

      const result = await response.text()
      expect(result.toLowerCase()).toContain('local site dev server')
      expect(result.toLowerCase()).not.toContain('netlify')
      expect(devServer?.output).not.toContain('Proxying to https://www.netlify.app')
    })

    test<FixtureTestContext>('nested route redirect check for the page existence', async ({ devServer }) => {
      let response = await fetch(`http://localhost:${devServer.port}/test/exists`)
      expect(response.status).toBe(200)

      let result = await response.text()
      expect(result.toLowerCase()).toContain('exists page')
      expect(devServer?.output).not.toContain('Proxying to https://www.netlify.app/exists')

      response = await fetch(`http://localhost:${devServer.port}/test/about`)
      expect(response.status).toBe(200)

      result = await response.text()
      expect(result.toLowerCase()).toContain('netlify')

      expect(devServer?.output).toContain('Proxying to https://www.netlify.app/about')
    })

    test<FixtureTestContext>('should do local redirect', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/local/test/exists`)

      expect(response.status).toBe(200)

      const result = await response.text()
      expect(response.headers.get('location')).toBeNull()
      expect(response.status).toBe(200)
      expect(result.toLowerCase()).toContain('exists page')
      expect(result.toLowerCase()).not.toContain('netlify')
      expect(devServer?.output).not.toContain('Proxying to https://www.netlify.app/test')
    })
  })

  setupFixtureTests('site-with-redirect', { devServer: true }, () => {
    test<FixtureTestContext>('should do local redirect', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/local/test/exists`)

      expect(response.status).toBe(200)

      const result = await response.text()
      expect(response.url).toEqual(`http://localhost:${devServer.port}/local/test/exists`)
      expect(response.status).toBe(200)
      expect(result.toLowerCase()).toContain('exists page')
      expect(result.toLowerCase()).not.toContain('netlify')
      expect(devServer?.output).not.toContain('Proxying to https://www.netlify.app')
    })

    test<FixtureTestContext>('should pass proper status code of the redirected page', async ({ devServer }) => {
      let response = await fetch(`http://localhost:${devServer.port}/local/test/not-allowed`)

      expect(response.status).toBe(405)
      const result = await response.text()
      expect(result.toLowerCase()).toContain('this not allowed')

      response = await fetch(`http://localhost:${devServer.port}/local/test/not-found`)
      expect(response.status).toBe(404)

      response = await fetch(`http://localhost:${devServer.port}/local-force/test/exists`)
      expect(response.status).toBe(402)
    })
  })

  test('should not check the endpoint existence for hidden proxies', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: './index.js',
          content: `
          const http = require('http')
          const server = http.createServer((req, res) => {
            console.log('Got request main server', req.method, req.url)
            res.end()
          })
          server.listen(6125)

          const proxyServer = http.createServer((req, res) => {
            console.log('Got request proxy server', req.method, req.url)
            res.end()
          })
          proxyServer.listen(6126)
          `,
        })
        .withNetlifyToml({
          config: {
            dev: {
              targetPort: 6125,
              command: 'node index.js',
            },
            redirects: [
              {
                from: '/from-hidden',
                to: 'http://localhost:6126/to',
                status: 200,
                headers: { 'x-nf-hidden-proxy': 'true' },
              },
              { from: '/from', to: 'http://localhost:6126/to', status: 200 },
            ],
          },
        })
        .build()

      await withDevServer(
        { cwd: builder.directory, env: { NETLIFY_DEV_SERVER_CHECK_SSG_ENDPOINTS: '1' } },
        async ({ outputBuffer, url }) => {
          await fetch(new URL('/from-hidden', url))
          t.expect(String(outputBuffer)).not.toContain('Got request main server')
          t.expect(String(outputBuffer)).toContain('Got request proxy server GET /to')
          await fetch(new URL('/from', url))
          t.expect(String(outputBuffer.join(''))).toContain(
            'Got request main server HEAD /from\nGot request main server GET /from',
          )
        },
      )
    })
  })
})
