import { killProcess } from '@netlify/dev-utils'
import js from 'dedent'
import execa from 'execa'
import getPort from 'get-port'
import fetch from 'node-fetch'
import semver from 'semver'
import { describe, test } from 'vitest'

import { waitPort } from '../../../../src/lib/wait-port.js'
import { cliPath } from '../../utils/cli-path.js'
import { withMockApi } from '../../utils/mock-api.js'
import { type SiteBuilder, withSiteBuilder } from '../../utils/site-builder.js'
import { InvokeFunctionResult } from '../../../../src/lib/functions/runtimes/index.js'
import {
  assertAIGatewayValue,
  createAIGatewayCheckFunction,
  createAIGatewayTestData,
} from '../../utils/ai-gateway-helpers.js'

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

    const result = await waitPort(port, 'localhost', SERVE_TIMEOUT)
    if (!result.open) {
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

  test('should thread env vars from user env to function execution environment', async (t) => {
    const port = await getPort()
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'netlify/functions/get-env.js',
          content: `
          export default async () => Response.json(process.env)
          export const config = { path: "/get-env" }
          `,
        })
        .build()

      await withFunctionsServer({ builder, args: ['--port', port.toString()], port, env: { foo: 'bar' } }, async () => {
        const response = await fetch(`http://localhost:${port.toString()}/get-env`)
        t.expect(await response.json()).toMatchObject(t.expect.objectContaining({ foo: 'bar' }))
      })
    })
  })

  test('should thread `NODE_OPTIONS` if set in user env to function execution environment', async (t) => {
    const port = await getPort()
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'netlify/functions/get-env.js',
          content: `
          export default async () => new Response(process.env.NODE_OPTIONS)
          export const config = { path: "/get-env" }
          `,
        })
        .build()

      await withFunctionsServer(
        {
          builder,
          args: ['--port', port.toString()],
          port,
          env: { NODE_OPTIONS: '--abort-on-uncaught-exception --trace-exit' },
        },
        async () => {
          const response = await fetch(`http://localhost:${port.toString()}/get-env`)
          t.expect(await response.text()).toContain('--abort-on-uncaught-exception --trace-exit')
        },
      )
    })
  })

  // Testing just 22.12.0+ for simplicity. The real range is quite complex.
  test.runIf(semver.gte(process.versions.node, '22.12.0'))(
    'should add AWS Lambda compat `NODE_OPTIONS` to function execution environment',
    async (t) => {
      const port = await getPort()
      await withSiteBuilder(t, async (builder) => {
        await builder
          .withContentFile({
            path: 'netlify/functions/get-env.js',
            content: `
          export default async () => new Response(process.env.NODE_OPTIONS)
          export const config = { path: "/get-env" }
          `,
          })
          .build()

        await withFunctionsServer(
          {
            builder,
            args: ['--port', port.toString()],
            port,
            env: { NODE_OPTIONS: '--abort-on-uncaught-exception --trace-exit' },
          },
          async () => {
            const response = await fetch(`http://localhost:${port.toString()}/get-env`)
            const body = await response.text()
            t.expect(body).toContain('--no-experimental-require-module')
            t.expect(body).toContain('--no-experimental-detect-module')
            t.expect(body).toContain('--abort-on-uncaught-exception --trace-exit')
          },
        )
      })
    },
  )

  test.runIf(
    process.allowedNodeEnvironmentFlags.has('--no-experimental-require-module') ||
      process.allowedNodeEnvironmentFlags.has('--experimental-require-module'),
  )('should allow user to re-enable experimental require module feature', async (t) => {
    const port = await getPort()
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'netlify/functions/get-env.js',
          content: `
          export default async () => new Response(process.env.NODE_OPTIONS)
          export const config = { path: "/get-env" }
          `,
        })
        .build()

      await withFunctionsServer(
        {
          builder,
          args: ['--port', port.toString()],
          port,
          env: { NODE_OPTIONS: '--experimental-require-module' },
        },
        async () => {
          const response = await fetch(`http://localhost:${port.toString()}/get-env`)
          const body = await response.text()
          t.expect(body).toContain('--experimental-require-module')
          t.expect(body).not.toContain('--no-experimental-require-module')
        },
      )
    })
  })

  test.runIf(
    process.allowedNodeEnvironmentFlags.has('--no-experimental-detect-module') ||
      process.allowedNodeEnvironmentFlags.has('--experimental-detect-module'),
  )('should allow user to re-enable experimental detect module feature', async (t) => {
    const port = await getPort()
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'netlify/functions/get-env.js',
          content: `
          export default async () => new Response(process.env.NODE_OPTIONS)
          export const config = { path: "/get-env" }
          `,
        })
        .build()

      await withFunctionsServer(
        {
          builder,
          args: ['--port', port.toString()],
          port,
          env: { NODE_OPTIONS: '--experimental-detect-module' },
        },
        async () => {
          const response = await fetch(`http://localhost:${port.toString()}/get-env`)
          const body = await response.text()
          t.expect(body).toContain('--experimental-detect-module')
          t.expect(body).not.toContain('--no-experimental-detect-module')
        },
      )
    })
  })

  test('should inject AI Gateway when linked site and online', async (t) => {
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
            const response = await fetch(`http://localhost:${port.toString()}${checkFunction.urlPath}`)
            const result = (await response.json()) as { hasAIGateway: boolean; aiGatewayValue: string | null }

            t.expect(response.status).toBe(200)
            assertAIGatewayValue(t, result, aiGatewayToken.token, `${siteInfo.ssl_url}/.netlify/ai`)
          },
        )
      })
    })
  })

  test('should not inject AI Gateway when site is unlinked in functions serve', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const checkFunction = createAIGatewayCheckFunction()

      await builder
        .withContentFile({
          path: checkFunction.path,
          content: checkFunction.content,
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
          const response = await fetch(`http://localhost:${port.toString()}${checkFunction.urlPath}`)
          const result = (await response.json()) as { hasAIGateway: boolean }

          t.expect(response.status).toBe(200)
          t.expect(result.hasAIGateway).toBe(false)
        },
      )
    })
  })

  test('should inject AI Gateway for V2 functions in functions serve', async (t) => {
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
            const response = await fetch(`http://localhost:${port.toString()}${checkFunction.urlPath}`)
            const result = (await response.json()) as { hasAIGateway: boolean; aiGatewayValue: string | null }

            t.expect(response.status).toBe(200)
            assertAIGatewayValue(t, result, aiGatewayToken.token, `${siteInfo.ssl_url}/.netlify/ai`)
          },
        )
      })
    })
  })
})
