import { killProcess } from '@netlify/dev-utils'
import js from 'dedent'
import execa from 'execa'
import getPort from 'get-port'
import fetch from 'node-fetch'
import { describe, test } from 'vitest'
import waitPort from 'wait-port'

import { cliPath } from '../../utils/cli-path.js'
import { withMockApi } from '../../utils/mock-api.js'
import { type SiteBuilder, withSiteBuilder } from '../../utils/site-builder.js'
import { InvokeFunctionResult } from '../../../../src/lib/functions/runtimes/index.js'

const DEFAULT_PORT = 9999
const SERVE_TIMEOUT = 180_000

const withFunctionsServer = async (
  {
    args = [],
    builder,
    port = DEFAULT_PORT,
    env = {},
  }: {
    args?: string[]
    builder: SiteBuilder
    port?: number
    env?: NodeJS.ProcessEnv
  },
  testHandler: () => Promise<unknown>,
) => {
  let ps
  try {
    ps = execa(cliPath, ['functions:serve', ...args], {
      cwd: builder.directory,
      env: { ...process.env, ...env },
    })

    ps.stdout?.on('data', (data: Buffer) => {
      console.log(data.toString())
    })
    ps.stderr?.on('data', (data: Buffer) => {
      console.log(data.toString())
    })

    const { open } = await waitPort({
      port,
      output: 'silent',
      timeout: SERVE_TIMEOUT,
    })
    if (!open) {
      throw new Error('Timed out waiting for functions server')
    }
    return await testHandler()
  } finally {
    if (ps !== undefined) {
      await killProcess(ps)
    }
  }
}

describe.concurrent('functions:serve command', () => {
  test('should serve functions on default port', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'ping.js',
          handler: js`async () => ({
            statusCode: 200,
            body: 'ping',
          })`,
        })
        .build()

      await withFunctionsServer({ builder }, async () => {
        const response = await fetch(`http://localhost:9999/.netlify/functions/ping`)
        t.expect(await response.text()).toEqual('ping')
      })
    })
  })

  test('should serve functions on custom port', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'ping.js',
          handler: js`async () => ({
            statusCode: 200,
            body: 'ping',
          })`,
        })
        .build()

      const port = await getPort()
      await withFunctionsServer({ builder, args: ['--port', port.toString()], port }, async () => {
        const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/ping`)
        t.expect(await response.text()).toEqual('ping')
      })
    })
  })

  test('should use settings from netlify.toml dev', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const port = await getPort()
      await builder
        .withNetlifyToml({
          config: { functions: { directory: 'functions' }, dev: { functions: 'other', functionsPort: port } },
        })
        .withFunction({
          pathPrefix: 'other',
          path: 'ping.js',
          handler: js`async () => ({
            statusCode: 200,
            body: 'ping',
          })`,
        })
        .build()

      await withFunctionsServer({ builder, port }, async () => {
        const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/ping`)
        t.expect(await response.text()).toEqual('ping')
      })
    })
  })

  test('should inject env variables', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            build: { environment: { MY_CONFIG: 'FROM_CONFIG_FILE' } },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'echo-env.js',
          handler: () =>
            Promise.resolve({
              statusCode: 200,
              body: process.env.MY_CONFIG,
            }),
        })
        .build()

      const port = await getPort()
      await withFunctionsServer({ builder, args: ['--port', port.toString()], port }, async () => {
        const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/echo-env`)
        t.expect(await response.text()).toEqual('FROM_CONFIG_FILE')
      })
    })
  })

  test('should handle content-types with charset', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({
          config: { functions: { directory: 'functions' } },
        })
        .withFunction({
          path: 'echo-event.js',
          handler: js`
          async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          })`,
        })
        .build()

      const port = await getPort()
      await withFunctionsServer({ builder, args: ['--port', port.toString()], port }, async () => {
        const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/echo-event`, {
          headers: { 'content-type': 'application/json; charset=utf-8' },
        })
        const jsonResponse = (await response.json()) as InvokeFunctionResult
        t.expect(jsonResponse.isBase64Encoded).toBe(false)
      })
    })
  })

  test('should serve V2 functions', async (t) => {
    const port = await getPort()
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'netlify/functions/ping.js',
          content: `
          export default () => new Response("ping")
          export const config = { path: "/ping" }
          `,
        })
        .build()

      await withFunctionsServer({ builder, args: ['--port', port.toString()], port }, async () => {
        const response = await fetch(`http://localhost:${port.toString()}/ping`)
        t.expect(await response.text()).toEqual('ping')
      })
    })
  })

  test('should inject AI Gateway when linked site and online', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const siteInfo = {
        account_slug: 'test-account',
        id: 'test-site-id',
        name: 'site-name',
        ssl_url: 'https://test-site.netlify.app',
      }
      
      const aiGatewayToken = {
        token: 'ai-gateway-token-functions',
        url: 'https://api.netlify.com/.netlify/ai/',
      }

      const routes = [
        { path: 'sites/test-site-id', response: siteInfo },
        { path: 'sites/test-site-id/service-instances', response: [] },
        { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
        { path: 'sites/test-site-id/ai-gateway/token', response: aiGatewayToken },
      ]

      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'check-ai-gateway.js',
          handler: () => {
            return Promise.resolve({
              statusCode: 200,
              body: JSON.stringify({
                hasAIGateway: !!process.env.AI_GATEWAY,
                aiGatewayValue: process.env.AI_GATEWAY || null,
              }),
            })
          },
        })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const port = await getPort()
        await withFunctionsServer(
          {
            builder,
            args: ['--port', port.toString()],
            port,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_SITE_ID: siteInfo.id,
              NETLIFY_AUTH_TOKEN: 'fake-token',
            },
          },
          async () => {
            const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/check-ai-gateway`)
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

  test('should not inject AI Gateway when site is unlinked in functions serve', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'check-ai-gateway.js',
          handler: () => {
            return Promise.resolve({
              statusCode: 200,
              body: JSON.stringify({
                hasAIGateway: !!process.env.AI_GATEWAY,
              }),
            })
          },
        })
        .build()

      const port = await getPort()
      await withFunctionsServer(
        {
          builder,
          args: ['--port', port.toString()],
          port,
          env: {
            NETLIFY_AUTH_TOKEN: 'fake-token',
          },
        },
        async () => {
          const response = await fetch(`http://localhost:${port.toString()}/.netlify/functions/check-ai-gateway`)
          const result = await response.json() as { hasAIGateway: boolean }

          t.expect(response.status).toBe(200)
          t.expect(result.hasAIGateway).toBe(false)
        },
      )
    })
  })

  test('should inject AI Gateway for V2 functions in functions serve', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const siteInfo = {
        account_slug: 'test-account',
        id: 'test-site-id',
        name: 'site-name',
        ssl_url: 'https://test-site.netlify.app',
      }
      
      const aiGatewayToken = {
        token: 'ai-gateway-token-v2-functions',
        url: 'https://api.netlify.com/.netlify/ai/',
      }

      const routes = [
        { path: 'sites/test-site-id', response: siteInfo },
        { path: 'sites/test-site-id/service-instances', response: [] },
        { path: 'accounts', response: [{ slug: siteInfo.account_slug }] },
        { path: 'sites/test-site-id/ai-gateway/token', response: aiGatewayToken },
      ]

      await builder
        .withContentFile({
          path: 'netlify/functions/check-ai-gateway-v2.js',
          content: `
          export default () => {
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
          }
          export const config = { path: "/check-ai-gateway-v2" }
          `,
        })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const port = await getPort()
        await withFunctionsServer(
          {
            builder,
            args: ['--port', port.toString()],
            port,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_SITE_ID: siteInfo.id,
              NETLIFY_AUTH_TOKEN: 'fake-token',
            },
          },
          async () => {
            const response = await fetch(`http://localhost:${port.toString()}/check-ai-gateway-v2`)
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
