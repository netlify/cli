import { describe, expect, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

describe('redirects', async () => {
  await setupFixtureTests('dev-server-with-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should send original query params to functions', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer!.port}/with-params?param2=world&other=1`, {})

      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result).not.toHaveProperty('queryStringParameters.param1')
      expect(result).toHaveProperty('queryStringParameters.param2', 'world')
      expect(result).toHaveProperty('queryStringParameters.other', '1')
    })

    test<FixtureTestContext>('should send original query params to functions when using duplicate parameters', async ({
      devServer,
    }) => {
      const response = await fetch(`http://localhost:${devServer!.port}/api/echo?param=hello&param=world`, {})

      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result).toHaveProperty('queryStringParameters.param', 'hello, world')
      expect(result).toHaveProperty('multiValueQueryStringParameters.param', ['hello', 'world'])
    })
  })

  await setupFixtureTests('next-app', { devServer: { env: { NETLIFY_DEV_SERVER_CHECK_SSG_ENDPOINTS: 1 } } }, () => {
    test<FixtureTestContext>('should prefer local files instead of redirect when not forced', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer!.port}/test.txt`, {})

      expect(response.status).toBe(200)

      const result = await response.text()
      expect(result.trim()).toEqual('hello world')
    })

    test<FixtureTestContext>('should check for the dynamic page existence before doing redirect', async ({
      devServer,
    }) => {
      const response = await fetch(`http://localhost:${devServer!.port}/`, {})

      expect(response.status).toBe(200)

      const result = await response.text()
      expect(result.toLowerCase()).not.toContain('netlify')
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
