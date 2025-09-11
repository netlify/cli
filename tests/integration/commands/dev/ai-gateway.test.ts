import { describe, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

describe.concurrent('AI Gateway Integration', () => {
  test('should setup AI Gateway environment when site is linked and online', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const siteInfo = {
        account_slug: 'test-account',
        id: 'test-site-id',
        name: 'site-name', 
        ssl_url: 'https://test-site.netlify.app',
      }
      
      const aiGatewayToken = {
        token: 'ai-gateway-token-123',
        url: 'https://api.netlify.com/.netlify/ai/',
      }

      const routes = [
        { path: 'sites/test-site-id', response: siteInfo },
        { path: 'sites/test-site-id/service-instances', response: [] },
        { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
        { path: 'accounts/test-account/env', response: [] },
        { path: 'sites/test-site-id/ai-gateway/token', response: aiGatewayToken },
      ]

      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'check-ai-gateway.js',
          handler: `async () => {
            return {
              statusCode: 200,
              body: JSON.stringify({
                hasAIGateway: !!process.env.AI_GATEWAY,
                aiGatewayValue: process.env.AI_GATEWAY || null,
              }),
            }
          }`,
        })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await withDevServer(
          {
            cwd: builder.directory,
            offline: false,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_SITE_ID: siteInfo.id,
              NETLIFY_AUTH_TOKEN: 'fake-token',
            },
          },
          async (server) => {
            const response = await fetch(`${server.url}/.netlify/functions/check-ai-gateway`)
            const result = await response.json() as { hasAIGateway: boolean; aiGatewayValue: string | null }

            t.expect(response.status).toBe(200)
            t.expect(result.hasAIGateway).toBe(true)
            t.expect(result.aiGatewayValue).toBeDefined()

            if (result.aiGatewayValue) {
              const decodedPayload = JSON.parse(Buffer.from(result.aiGatewayValue, 'base64').toString())
              t.expect(decodedPayload).toHaveProperty('token', aiGatewayToken.token)
              t.expect(decodedPayload).toHaveProperty('url', `${siteInfo.ssl_url}/.netlify/ai`)
            }
          },
        )
      })
    })
  })

  test('should not setup AI Gateway when site is unlinked', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'check-ai-gateway.js',
          handler: `async () => {
            return {
              statusCode: 200,
              body: JSON.stringify({
                hasAIGateway: !!process.env.AI_GATEWAY,
              }),
            }
          }`,
        })
        .build()

      await withDevServer(
        {
          cwd: builder.directory,
          offline: false,
          env: {
            NETLIFY_AUTH_TOKEN: 'fake-token',
          },
        },
        async (server) => {
          const response = await fetch(`${server.url}/.netlify/functions/check-ai-gateway`)
          const result = await response.json() as { hasAIGateway: boolean }

          t.expect(response.status).toBe(200)
          t.expect(result.hasAIGateway).toBe(false)
        },
      )
    })
  })

  test('should not setup AI Gateway when offline', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const siteInfo = {
        account_slug: 'test-account',
        id: 'test-site-id',
        name: 'site-name',
        ssl_url: 'https://test-site.netlify.app',
      }

      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'check-ai-gateway.js',
          handler: `async () => {
            return {
              statusCode: 200,
              body: JSON.stringify({
                hasAIGateway: !!process.env.AI_GATEWAY,
              }),
            }
          }`,
        })
        .build()

      await withDevServer(
        {
          cwd: builder.directory,
          offline: true,
          env: {
            NETLIFY_SITE_ID: siteInfo.id,
            NETLIFY_AUTH_TOKEN: 'fake-token',
          },
        },
        async (server) => {
          const response = await fetch(`${server.url}/.netlify/functions/check-ai-gateway`)
          const result = await response.json() as { hasAIGateway: boolean }

          t.expect(response.status).toBe(200)
          t.expect(result.hasAIGateway).toBe(false)
        },
      )
    })
  })

  test('should not setup AI Gateway when no siteUrl', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const siteInfo = {
        account_slug: 'test-account',
        id: 'test-site-id',
        name: 'site-name',
        ssl_url: null,
      }

      const routes = [
        { path: 'sites/test-site-id', response: siteInfo },
        { path: 'sites/test-site-id/service-instances', response: [] },
        { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
        { path: 'accounts/test-account/env', response: [] },
      ]

      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'check-ai-gateway.js',
          handler: `async () => {
            return {
              statusCode: 200,
              body: JSON.stringify({
                hasAIGateway: !!process.env.AI_GATEWAY,
              }),
            }
          }`,
        })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await withDevServer(
          {
            cwd: builder.directory,
            offline: false,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_SITE_ID: siteInfo.id,
              NETLIFY_AUTH_TOKEN: 'fake-token',
            },
          },
          async (server) => {
            const response = await fetch(`${server.url}/.netlify/functions/check-ai-gateway`)
            const result = await response.json() as { hasAIGateway: boolean }

            t.expect(response.status).toBe(200)
            t.expect(result.hasAIGateway).toBe(false)
          },
        )
      })
    })
  })

  test('should handle AI Gateway API failures gracefully', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const siteInfo = {
        account_slug: 'test-account',
        id: 'test-site-id',
        name: 'site-name',
        ssl_url: 'https://test-site.netlify.app',
      }

      const routes = [
        { path: 'sites/test-site-id', response: siteInfo },
        { path: 'sites/test-site-id/service-instances', response: [] },
        { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
        { path: 'accounts/test-account/env', response: [] },
        { path: 'sites/test-site-id/ai-gateway/token', status: 404, response: { message: 'Not Found' } },
      ]

      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'check-ai-gateway.js',
          handler: `async () => {
            return {
              statusCode: 200,
              body: JSON.stringify({
                hasAIGateway: !!process.env.AI_GATEWAY,
              }),
            }
          }`,
        })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await withDevServer(
          {
            cwd: builder.directory,
            offline: false,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_SITE_ID: siteInfo.id,
              NETLIFY_AUTH_TOKEN: 'fake-token',
            },
          },
          async (server) => {
            const response = await fetch(`${server.url}/.netlify/functions/check-ai-gateway`)
            const result = await response.json() as { hasAIGateway: boolean }

            t.expect(response.status).toBe(200)
            t.expect(result.hasAIGateway).toBe(false)
          },
        )
      })
    })
  })

  test('should work with V2 functions', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const siteInfo = {
        account_slug: 'test-account',
        id: 'test-site-id',
        name: 'site-name',
        ssl_url: 'https://test-site.netlify.app',
      }
      
      const aiGatewayToken = {
        token: 'ai-gateway-token-v2',
        url: 'https://api.netlify.com/.netlify/ai/',
      }

      const routes = [
        { path: 'sites/test-site-id', response: siteInfo },
        { path: 'sites/test-site-id/service-instances', response: [] },
        { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
        { path: 'accounts/test-account/env', response: [] },
        { path: 'sites/test-site-id/ai-gateway/token', response: aiGatewayToken },
      ]

      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'check-ai-gateway-v2.js',
          runtimeAPIVersion: 2,
          handler: `async () => {
            return new Response(
              JSON.stringify({
                hasAIGateway: !!process.env.AI_GATEWAY,
                aiGatewayValue: process.env.AI_GATEWAY || null,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }`,
        })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await withDevServer(
          {
            cwd: builder.directory,
            offline: false,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_SITE_ID: siteInfo.id,
              NETLIFY_AUTH_TOKEN: 'fake-token',
            },
          },
          async (server) => {
            const response = await fetch(`${server.url}/.netlify/functions/check-ai-gateway-v2`)
            const result = await response.json() as { hasAIGateway: boolean; aiGatewayValue: string | null }

            t.expect(response.status).toBe(200)
            t.expect(result.hasAIGateway).toBe(true)
            t.expect(result.aiGatewayValue).toBeDefined()

            if (result.aiGatewayValue) {
              const decodedPayload = JSON.parse(Buffer.from(result.aiGatewayValue, 'base64').toString())
              t.expect(decodedPayload).toHaveProperty('token', aiGatewayToken.token)
              t.expect(decodedPayload).toHaveProperty('url', `${siteInfo.ssl_url}/.netlify/ai`)
            }
          },
        )
      })
    })
  })

  test('should work with staging environment URLs', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const siteInfo = {
        account_slug: 'test-account',
        id: 'test-site-id',
        name: 'site-name',
        ssl_url: 'https://test-site--staging.netlify.app',
      }
      
      const aiGatewayToken = {
        token: 'ai-gateway-token-staging',
        url: 'https://api.netlify.com/.netlify/ai/',
      }

      const routes = [
        { path: 'sites/test-site-id', response: siteInfo },
        { path: 'sites/test-site-id/service-instances', response: [] },
        { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
        { path: 'accounts/test-account/env', response: [] },
        { path: 'sites/test-site-id/ai-gateway/token', response: aiGatewayToken },
      ]

      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'check-staging-url.js',
          handler: `async () => {
            return {
              statusCode: 200,
              body: JSON.stringify({
                hasAIGateway: !!process.env.AI_GATEWAY,
                aiGatewayValue: process.env.AI_GATEWAY || null,
              }),
            }
          }`,
        })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await withDevServer(
          {
            cwd: builder.directory,
            offline: false,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_SITE_ID: siteInfo.id,
              NETLIFY_AUTH_TOKEN: 'fake-token',
            },
          },
          async (server) => {
            const response = await fetch(`${server.url}/.netlify/functions/check-staging-url`)
            const result = await response.json() as { hasAIGateway: boolean; aiGatewayValue: string | null }

            t.expect(response.status).toBe(200)
            t.expect(result.hasAIGateway).toBe(true)
            t.expect(result.aiGatewayValue).toBeDefined()

            if (result.aiGatewayValue) {
              const decodedPayload = JSON.parse(Buffer.from(result.aiGatewayValue, 'base64').toString())
              t.expect(decodedPayload).toHaveProperty('token', aiGatewayToken.token)
              t.expect(decodedPayload).toHaveProperty('url', `${siteInfo.ssl_url}/.netlify/ai`)
            }
          },
        )
      })
    })
  })
})