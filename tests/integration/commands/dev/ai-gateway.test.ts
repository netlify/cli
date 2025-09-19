import { describe, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import {
  assertAIGatewayValue,
  createAIGatewayCheckFunction,
  createAIGatewayTestData,
  createMockApiFailureRoutes,
} from '../../utils/ai-gateway-helpers.js'

describe.concurrent('AI Gateway Integration', () => {
  test('should setup AI Gateway environment when site is linked and online', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const { siteInfo, aiGatewayToken, routes } = createAIGatewayTestData()
      const checkFunction = createAIGatewayCheckFunction()

      await builder
        .withContentFile({
          path: checkFunction.path,
          content: checkFunction.content,
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
            const response = await fetch(`${server.url}${checkFunction.urlPath}`)
            const result = (await response.json()) as { hasAIGateway: boolean; aiGatewayValue: string | null }

            t.expect(response.status).toBe(200)
            assertAIGatewayValue(t, result, aiGatewayToken.token, `${siteInfo.ssl_url}/.netlify/ai`)
          },
        )
      })
    })
  })

  test('should not setup AI Gateway when site is unlinked', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const checkFunction = createAIGatewayCheckFunction()

      await builder
        .withContentFile({
          path: checkFunction.path,
          content: checkFunction.content,
        })
        .build()

      await withDevServer(
        {
          cwd: builder.directory,
          offline: false,
          env: {
            NETLIFY_AUTH_TOKEN: 'fake-token',
            AI_GATEWAY: undefined,
          },
        },
        async (server) => {
          const response = await fetch(`${server.url}${checkFunction.urlPath}`)
          const result = (await response.json()) as { hasAIGateway: boolean }

          t.expect(response.status).toBe(200)
          t.expect(result.hasAIGateway).toBe(false)
        },
      )
    })
  })

  test('should not setup AI Gateway when offline', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const { siteInfo } = createAIGatewayTestData()
      const checkFunction = createAIGatewayCheckFunction()

      await builder
        .withContentFile({
          path: checkFunction.path,
          content: checkFunction.content,
        })
        .build()

      await withDevServer(
        {
          cwd: builder.directory,
          offline: true,
          env: {
            NETLIFY_SITE_ID: siteInfo.id,
            NETLIFY_AUTH_TOKEN: 'fake-token',
            AI_GATEWAY: undefined,
          },
        },
        async (server) => {
          const response = await fetch(`${server.url}${checkFunction.urlPath}`)
          const result = (await response.json()) as { hasAIGateway: boolean }

          t.expect(response.status).toBe(200)
          t.expect(result.hasAIGateway).toBe(false)
        },
      )
    })
  })

  test('should not setup AI Gateway when no siteUrl', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const { siteInfo: baseSiteInfo } = createAIGatewayTestData()
      const siteInfo = { ...baseSiteInfo, ssl_url: null }
      const checkFunction = createAIGatewayCheckFunction()

      const routes = [
        { path: 'sites/test-site-id', response: siteInfo },
        { path: 'sites/test-site-id/service-instances', response: [] },
        { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
        { path: 'accounts/test-account/env', response: [] },
      ]

      await builder
        .withContentFile({
          path: checkFunction.path,
          content: checkFunction.content,
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
              AI_GATEWAY: undefined,
            },
          },
          async (server) => {
            const response = await fetch(`${server.url}${checkFunction.urlPath}`)
            const result = (await response.json()) as { hasAIGateway: boolean }

            t.expect(response.status).toBe(200)
            t.expect(result.hasAIGateway).toBe(false)
          },
        )
      })
    })
  })

  test('should handle AI Gateway API failures gracefully', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const { siteInfo } = createAIGatewayTestData()
      const routes = createMockApiFailureRoutes(siteInfo)
      const checkFunction = createAIGatewayCheckFunction()

      await builder
        .withContentFile({
          path: checkFunction.path,
          content: checkFunction.content,
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
              AI_GATEWAY: undefined,
            },
          },
          async (server) => {
            const response = await fetch(`${server.url}${checkFunction.urlPath}`)
            const result = (await response.json()) as { hasAIGateway: boolean }

            t.expect(response.status).toBe(200)
            t.expect(result.hasAIGateway).toBe(false)
          },
        )
      })
    })
  })

  test('should work with V2 functions', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const { siteInfo, aiGatewayToken, routes } = createAIGatewayTestData()
      const checkFunction = createAIGatewayCheckFunction()

      await builder
        .withContentFile({
          path: checkFunction.path,
          content: checkFunction.content,
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
            const response = await fetch(`${server.url}${checkFunction.urlPath}`)
            const result = (await response.json()) as { hasAIGateway: boolean; aiGatewayValue: string | null }

            t.expect(response.status).toBe(200)
            assertAIGatewayValue(t, result, aiGatewayToken.token, `${siteInfo.ssl_url}/.netlify/ai`)
          },
        )
      })
    })
  })

  test('should work with staging environment URLs', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const { siteInfo: baseSiteInfo, aiGatewayToken: baseToken } = createAIGatewayTestData()
      const siteInfo = { ...baseSiteInfo, ssl_url: 'https://test-site--staging.netlify.app' }
      const aiGatewayToken = { ...baseToken, token: 'ai-gateway-token-staging' }
      const checkFunction = createAIGatewayCheckFunction()

      const routes = [
        { path: 'sites/test-site-id', response: siteInfo },
        { path: 'sites/test-site-id/service-instances', response: [] },
        { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
        { path: 'accounts/test-account/env', response: [] },
        { path: 'sites/test-site-id/ai-gateway/token', response: aiGatewayToken },
      ]

      await builder
        .withContentFile({
          path: checkFunction.path,
          content: checkFunction.content,
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
            const response = await fetch(`${server.url}${checkFunction.urlPath}`)
            const result = (await response.json()) as { hasAIGateway: boolean; aiGatewayValue: string | null }

            t.expect(response.status).toBe(200)
            assertAIGatewayValue(t, result, aiGatewayToken.token, `${siteInfo.ssl_url}/.netlify/ai`)
          },
        )
      })
    })
  })
})
