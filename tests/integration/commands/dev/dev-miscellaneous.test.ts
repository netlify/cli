import events from 'node:events'
import { Buffer } from 'buffer'
import path from 'path'
import { platform } from 'process'
import { fileURLToPath } from 'url'

import { setProperty } from 'dot-prop'
import execa, { ExecaError } from 'execa'
import getAvailablePort from 'get-port'
import jwt from 'jsonwebtoken'
import fetch from 'node-fetch'
import { type TestContext, describe, test } from 'vitest'
import type { HandlerEvent, HandlerContext } from '@netlify/functions'
import type { Context as EdgeHandlerContext } from '@netlify/edge-functions'
import js from 'dedent'

import { cliPath } from '../../utils/cli-path.js'
import { getExecaOptions, withDevServer } from '../../utils/dev-server.js'
import { withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder, type SiteBuilder } from '../../utils/site-builder.js'
import { normalize } from '../../utils/snapshots.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const JWT_EXPIRY = 1_893_456_000
const getToken = async ({
  jwtRolePath = 'app_metadata.authorization.roles',
  jwtSecret = 'secret',
  roles,
}: {
  jwtRolePath?: string | undefined
  jwtSecret?: string | undefined
  roles?: string[] | undefined
}) => {
  const payload = {
    exp: JWT_EXPIRY,
    sub: '12345678',
  }
  return Promise.resolve(jwt.sign(setProperty(payload, jwtRolePath, roles), jwtSecret))
}

const setupRoleBasedRedirectsSite = (builder: SiteBuilder) => {
  builder
    .withContentFiles([
      {
        path: 'index.html',
        content: '<html>index</html>',
      },
      {
        path: 'admin/foo.html',
        content: '<html>foo</html>',
      },
    ])
    .withRedirectsFile({
      redirects: [{ from: `/admin/*`, to: ``, status: '200!', condition: 'Role=admin' }],
    })
  return builder
}

const validateRoleBasedRedirectsSite = async ({
  builder,
  jwtRolePath,
  jwtSecret,
  t,
}: {
  builder: SiteBuilder
  jwtRolePath?: string | undefined
  jwtSecret?: string | undefined
  t: TestContext
}) => {
  const [adminToken, editorToken] = await Promise.all([
    getToken({ jwtSecret, jwtRolePath, roles: ['admin'] }),
    getToken({ jwtSecret, jwtRolePath, roles: ['editor'] }),
  ])

  await withDevServer({ cwd: builder.directory }, async (server) => {
    const [unauthenticatedResponse, authenticatedResponse, wrongRoleResponse] = await Promise.all([
      fetch(`${server.url}/admin`),
      fetch(`${server.url}/admin/foo`, {
        headers: {
          cookie: `nf_jwt=${adminToken}`,
        },
      }),
      fetch(`${server.url}/admin/foo`, {
        headers: {
          cookie: `nf_jwt=${editorToken}`,
        },
      }),
    ])
    t.expect(unauthenticatedResponse.status).toBe(404)
    t.expect(await unauthenticatedResponse.text()).toEqual('Not Found')

    t.expect(authenticatedResponse.status).toBe(200)
    t.expect(await authenticatedResponse.text()).toEqual('<html>foo</html>')

    t.expect(wrongRoleResponse.status).toBe(404)
    t.expect(await wrongRoleResponse.text()).toEqual('Not Found')
  })
}

describe.concurrent('commands/dev-miscellaneous', () => {
  test('should follow redirect for fully qualified rule', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: { publish: publicDir },
          },
        })
        .withContentFiles([
          {
            path: path.join(publicDir, 'index.html'),
            content: '<html>index</html>',
          },
          {
            path: path.join(publicDir, 'local-hello.html'),
            content: '<html>hello</html>',
          },
        ])
        .withRedirectsFile({
          redirects: [{ from: `http://localhost/hello-world`, to: `/local-hello`, status: 200 }],
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/hello-world`)

        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('<html>hello</html>')
      })
    })
  })

  test('should return 202 ok and empty response for background function', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'hello-background.js',
        handler: () => {
          console.log("Look at me I'm a background task")
        },
      })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/hello-background`)
        t.expect(response.status).toBe(202)
        t.expect(await response.text()).toEqual('')
      })
    })
  })

  test('should print logs emitted to `console` from user function handler', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'hello.js',
          handler: () => {
            console.log('Hello from the user function handler')
            return Response.json({})
          },
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ outputBuffer, url }) => {
        await fetch(`${url}/.netlify/functions/hello`)

        const output = outputBuffer.toString()
        t.expect(output).toMatch(/Hello from the user function handler/)
      })
    })
  })

  test('given a background function, context should have empty `clientContext` and null `identity`', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'hello-background.js',
          handler: (_: HandlerEvent, context: HandlerContext) => {
            console.log(`__CLIENT_CONTEXT__START__${JSON.stringify(context)}__CLIENT_CONTEXT__END__`)
          },
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ outputBuffer, url }) => {
        await fetch(`${url}/.netlify/functions/hello-background`)

        const output = outputBuffer.toString()
        const context = JSON.parse(output.match(/__CLIENT_CONTEXT__START__(.*)__CLIENT_CONTEXT__END__/)?.[1] ?? '""')
        t.expect(context).toHaveProperty('clientContext', {})
        t.expect(context).toHaveProperty('identity', null)
      })
    })
  })

  test('function clientContext.custom.netlify should be set', async (t) => {
    const { expect } = t

    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'hello.js',
          handler: async (_: HandlerEvent, context: HandlerContext) =>
            Promise.resolve({
              statusCode: 200,
              body: JSON.stringify(context),
            }),
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const res = await fetch(`${server.url}/.netlify/functions/hello`, {
          headers: {
            Authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzb3VyY2UiOiJuZXRsaWZ5IGRldiIsInRlc3REYXRhIjoiTkVUTElGWV9ERVZfTE9DQUxMWV9FTVVMQVRFRF9JREVOVElUWSJ9.2eSDqUOZAOBsx39FHFePjYj12k0LrxldvGnlvDu3GMI',
          },
        })
        const body = await res.json()

        expect(body).toHaveProperty(
          'clientContext.identity.url',
          'https://netlify-dev-locally-emulated-identity.netlify.app/.netlify/identity',
        )

        expect(body).toHaveProperty('clientContext.custom.netlify', expect.any(String))
        const rawNetlifyContext = (body as { clientContext: { custom: { netlify: string } } }).clientContext.custom
          .netlify
        const netlifyContext = Buffer.from(rawNetlifyContext, 'base64').toString('utf-8')
        expect(JSON.parse(netlifyContext)).toHaveProperty(
          'identity.url',
          'https://netlify-dev-locally-emulated-identity.netlify.app/.netlify/identity',
        )
      })
    })
  })

  test('should enforce role based redirects with default secret and role path', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      setupRoleBasedRedirectsSite(builder)
      await builder.build()
      await t.expect(validateRoleBasedRedirectsSite({ builder, t })).resolves.not.toThrowError()
    })
  })

  test('should enforce role based redirects with custom secret and role path', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const jwtSecret = 'custom'
      const jwtRolePath = 'roles'
      setupRoleBasedRedirectsSite(builder).withNetlifyToml({
        config: {
          dev: {
            jwtSecret,
            jwtRolePath,
          },
        },
      })
      await builder.build()
      await t.expect(validateRoleBasedRedirectsSite({ builder, t, jwtSecret, jwtRolePath })).resolves.not.toThrowError()
    })
  })

  test('Serves an Edge Function that terminates a response', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_functions: 'netlify/edge-functions',
            },
            edge_functions: [
              {
                function: 'hello',
                path: '/edge-function',
              },
            ],
          },
        })
        .withContentFiles([
          {
            path: path.join(publicDir, 'index.html'),
            content: '<html>index</html>',
          },
        ])
        .withEdgeFunction({
          handler: async (req, context) =>
            Response.json({
              requestID: req.headers.get('x-nf-request-id'),
              deploy: (context as EdgeHandlerContext & { deploy: { context: string; id: string; published: boolean } })
                .deploy,
            }),
          name: 'hello',
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/edge-function`)
        const responseBody = await response.json()

        t.expect(response.status).toBe(200)
        t.expect(responseBody).toEqual({
          requestID: response.headers.get('x-nf-request-id'),
          deploy: {
            context: 'dev',
            id: '0',
            published: false,
          },
        })
      })
    })
  })

  test('Serves an Edge Function with a rewrite', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_functions: 'netlify/edge-functions',
            },
            edge_functions: [
              {
                function: 'hello-legacy',
                path: '/hello-legacy',
              },
              {
                function: 'yell',
                path: '/hello',
              },
              {
                function: 'hello',
                path: '/hello',
              },
            ],
          },
        })
        .withContentFiles([
          {
            path: path.join(publicDir, 'goodbye.html'),
            content: '<html>goodbye</html>',
          },
        ])
        .withEdgeFunction({
          handler: async (_: Request, context: EdgeHandlerContext) => {
            const res = await context.next()
            const text = await res.text()

            return new Response(text.toUpperCase(), res)
          },
          name: 'yell',
        })
        .withEdgeFunction({
          handler: (_, context) => context.rewrite('/goodbye'),
          name: 'hello-legacy',
        })
        .withEdgeFunction({
          // return a URL instance from edge functions
          handler: async (req) => new URL('/goodbye', req.url),
          name: 'hello',
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const [response1, response2] = await Promise.all([
          fetch(`${server.url}/hello-legacy`),
          fetch(`${server.url}/hello`),
        ])

        t.expect(response1.status).toBe(200)
        t.expect(await response1.text()).toEqual('<html>goodbye</html>')

        t.expect(response2.status).toBe(200)
        t.expect(await response2.text()).toEqual('<HTML>GOODBYE</HTML>')
      })
    })
  })

  test('Serves an Edge Function with caching', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_functions: 'netlify/edge-functions',
            },
            edge_functions: [
              {
                function: 'hello',
                path: '/edge-function',
                cache: 'manual',
              },
            ],
          },
        })
        .withContentFiles([
          {
            path: path.join(publicDir, 'index.html'),
            content: '<html>index</html>',
          },
        ])
        .withEdgeFunction({
          handler: async () => new Response('Hello world'),
          name: 'hello',
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/edge-function`)

        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('Hello world')
      })
    })
  })

  test('Serves an Edge Function that includes context with project and deploy information', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_functions: 'netlify/edge-functions',
            },
            edge_functions: [
              {
                function: 'siteContext',
                path: '/*',
              },
            ],
          },
        })
        .withEdgeFunction({
          handler: async (_, context) => {
            const { deploy, site } = context
            return Promise.resolve(Response.json({ deploy, site }))
          },
          name: 'siteContext',
        })

      await builder.build()

      const siteInfo = {
        account_slug: 'test-account',
        id: 'site_id',
        name: 'site-name',
        url: 'site-url',
      }

      const routes = [
        { path: 'sites/site_id', response: siteInfo },
        { path: 'sites/site_id/service-instances', response: [] },
        {
          path: 'accounts',
          response: [{ slug: siteInfo.account_slug }],
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        await withDevServer(
          {
            cwd: builder.directory,
            offline: false,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_SITE_ID: 'site_id',
              NETLIFY_AUTH_TOKEN: 'fake-token',
            },
          },
          async (server) => {
            const response = await fetch(server.url)

            t.expect(response.status).toBe(200)
            t.expect(JSON.parse(await response.text())).toStrictEqual({
              deploy: { context: 'dev', id: '0', published: false },
              site: { id: 'site_id', name: 'site-name', url: server.url },
            })
          },
        )
      })
    })
  })

  test('Serves an Edge Function that transforms the response', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_functions: 'netlify/edge-functions',
            },
            edge_functions: [
              {
                function: 'yell',
                path: '/*',
              },
            ],
          },
        })
        .withContentFiles([
          {
            path: path.join(publicDir, 'hello.html'),
            content: '<html>hello</html>',
          },
        ])
        .withEdgeFunction({
          handler: async (_, context) => {
            const res = await context.next()
            const text = await res.text()

            return new Response(text.toUpperCase(), res)
          },
          name: 'yell',
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/hello`)

        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('<HTML>HELLO</HTML>')
      })
    })
  })

  test('Serves an Edge Function that streams the response', { retry: 3 }, async (t) => {
    const { expect } = t

    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_functions: 'netlify/edge-functions',
            },
            edge_functions: [
              {
                function: 'stream',
                path: '/stream',
              },
            ],
          },
        })
        .withEdgeFunction({
          handler: async () => {
            const body = new ReadableStream({
              async start(controller) {
                setInterval(() => {
                  const msg = new TextEncoder().encode(`${Date.now().toString()}\r\n`)
                  controller.enqueue(msg)
                }, 100)

                setTimeout(() => {
                  controller.close()
                }, 500)
              },
            })

            return Promise.resolve(
              new Response(body, {
                headers: {
                  'content-type': 'text/event-stream',
                },
                status: 200,
              }),
            )
          },
          name: 'stream',
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const res = await fetch(`${server.url}/stream`)
        const stream = res.body

        expect(stream).not.toBeNull()

        let numberOfChunks = 0
        stream!.on('data', () => {
          numberOfChunks += 1
        })
        await events.once(stream!, 'end')

        // streamed responses arrive in more than one batch
        expect(numberOfChunks).not.toBe(1)
      })
    })
  })

  test('When an edge function fails, serves a fallback defined by its `on_error` mode', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_functions: 'netlify/edge-functions',
            },
          },
        })
        .withContentFiles([
          {
            path: path.join(publicDir, 'hello-1.html'),
            content: '<html>hello from the origin</html>',
          },
        ])
        .withContentFiles([
          {
            path: path.join(publicDir, 'error-page.html'),
            content: '<html>uh-oh!</html>',
          },
        ])
        .withEdgeFunction({
          name: 'hello-1',
          config: { onError: 'bypass', path: '/hello-1' },
          handler: js`
            export default async () => {
              ermThisWillFail()
              return new Response('I will never get here')
            }
          `,
        })
        .withEdgeFunction({
          name: 'hello-2',
          config: { onError: '/error-page', path: '/hello-2' },
          handler: js`
            export default async () => {
              ermThisWillFail()
              return new Response('I will never get here')
            }
          `,
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const [response1, response2] = await Promise.all([
          fetch(`${server.url}/hello-1`),
          fetch(`${server.url}/hello-2`),
        ])

        t.expect(response1.status).toBe(200)
        t.expect(await response1.text()).toEqual('<html>hello from the origin</html>')
        t.expect(response2.status).toBe(200)
        t.expect(await response2.text()).toEqual('<html>uh-oh!</html>')
      })
    })
  })

  test('When an edge function throws uncaught exception, the dev server continues working', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            build: {
              edge_functions: 'netlify/edge-functions',
            },
          },
        })
        .withEdgeFunction({
          config: { path: '/hello' },
          handler: async () => {
            const url = new URL('/shouldve-provided-a-base')
            return new Response(url.toString())
          },
          name: 'hello-1',
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/hello`, {
          headers: {
            'Accept-Encoding': 'compress',
          },
        })
        t.expect(response.status).toBe(500)
        t.expect(await response.text()).toMatch(/TypeError: Invalid URL/)
      })
    })
  })

  test('redirect with country cookie', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFiles([
          {
            path: 'index.html',
            content: '<html>index</html>',
          },
          {
            path: 'index-es.html',
            content: '<html>index in spanish</html>',
          },
        ])
        .withRedirectsFile({
          redirects: [{ from: `/`, to: `/index-es.html`, status: '200!', condition: 'Country=ES' }],
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/`, {
          headers: {
            cookie: `nf_country=ES`,
          },
        })
        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('<html>index in spanish</html>')
      })
    })
  })

  test('redirect with country flag', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFiles([
          {
            path: 'index.html',
            content: '<html>index</html>',
          },
          {
            path: 'index-es.html',
            content: '<html>index in spanish</html>',
          },
        ])
        .withRedirectsFile({
          redirects: [{ from: `/`, to: `/index-es.html`, status: '200!', condition: 'Country=ES' }],
        })

      await builder.build()

      // NOTE: default fallback for country is 'US' if no flag is provided
      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/`)
        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('<html>index</html>')
      })

      await withDevServer({ cwd: builder.directory, args: ['--country=ES'] }, async (server) => {
        const response = await fetch(`${server.url}/`)
        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('<html>index in spanish</html>')
      })
    })
  })

  test(`doesn't hang when sending a application/json POST request to function server`, async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const functionsPort = 6666
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' }, dev: { functionsPort } } })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ port, url }) => {
        const response = await fetch(`${url.replace(port.toString(), functionsPort.toString())}/test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: '{}',
        })
        t.expect(response.status).toBe(404)
        t.expect(await response.text()).toEqual('Function not found...')
      })
    })
  })

  test(`catches invalid function names`, async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const functionsPort = 6667
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' }, dev: { functionsPort } } })
        .withFunction({
          path: 'exclamat!on.js',
          handler: async (event: HandlerEvent) =>
            Promise.resolve({
              statusCode: 200,
              body: JSON.stringify(event),
            }),
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ port, url }) => {
        const response = await fetch(
          `${url.replace(port.toString(), functionsPort.toString())}/.netlify/functions/exclamat!on`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: '{}',
          },
        )
        t.expect(response.status).toBe(400)
        t.expect(await response.text()).toEqual(
          'Function name should consist only of alphanumeric characters, hyphen & underscores.',
        )
      })
    })
  })

  // on windows, fetch throws an error while files are refreshing instead of returning the old value
  test.skipIf(platform === 'win32')('should detect content changes in edge functions', { retry: 3 }, async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_functions: 'netlify/edge-functions',
            },
            edge_functions: [
              {
                function: 'hello',
                path: '/hello',
              },
            ],
          },
        })
        .withEdgeFunction({
          handler: async () => new Response('Hello world'),
          name: 'hello',
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async ({ port, waitForLogMatching }) => {
        const helloWorldMessage = await fetch(`http://localhost:${port}/hello`).then((res) => res.text())

        await builder
          .withEdgeFunction({
            handler: async () => new Response('Hello builder'),
            name: 'hello',
          })
          .build()

        await waitForLogMatching('Reloaded edge function', { timeout: 500 })

        const helloBuilderMessage = await fetch(`http://localhost:${port}/hello`, {}).then((res) => res.text())

        t.expect(helloWorldMessage).toEqual('Hello world')
        t.expect(helloBuilderMessage).toEqual('Hello builder')
      })
    })
  })

  test('should detect deleted edge functions', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_functions: 'netlify/edge-functions',
            },
            edge_functions: [
              {
                function: 'auth',
                path: '/auth',
              },
            ],
          },
        })
        .withEdgeFunction({
          handler: async () => new Response('Auth response'),
          name: 'auth',
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async ({ port, waitForLogMatching }) => {
        const authResponseMessage = await fetch(`http://localhost:${port}/auth`).then((response) => response.text())

        await builder
          .withoutFile({
            path: 'netlify/edge-functions/auth.js',
          })
          .build()

        await waitForLogMatching('Removed edge function', { timeout: 500 })

        const authNotFoundMessage = await fetch(`http://localhost:${port}/auth`).then((response) => response.text())

        t.expect(authResponseMessage).toEqual('Auth response')
        t.expect(authNotFoundMessage).toEqual('404 Not Found')
      })
    })
  })

  test('should respect in-source configuration from edge functions', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_functions: 'netlify/edge-functions',
            },
          },
        })
        .withEdgeFunction({
          config: { path: '/hello-1' },
          handler: async () => new Response('Hello world'),
          name: 'hello',
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async ({ port, waitForLogMatching }) => {
        const res1 = await fetch(`http://localhost:${port}/hello-1`)

        t.expect(res1.status).toBe(200)
        t.expect(await res1.text()).toEqual('Hello world')

        await waitForLogMatching('Loaded edge function', { timeout: 500 })

        await builder
          .withEdgeFunction({
            config: { path: ['/hello-2', '/hello-3'] },
            handler: async () => new Response('Hello world'),
            name: 'hello',
          })
          .build()

        await waitForLogMatching('Reloaded edge function', { timeout: 500 })

        const [res2, res3, res4] = await Promise.all([
          fetch(`http://localhost:${port}/hello-1`),
          fetch(`http://localhost:${port}/hello-2`),
          fetch(`http://localhost:${port}/hello-3`),
        ])

        t.expect(res2.status).toBe(404)

        t.expect(res3.status).toBe(200)
        t.expect(await res3.text()).toEqual('Hello world')

        t.expect(res4.status).toBe(200)
        t.expect(await res4.text()).toEqual('Hello world')
      })
    })
  })

  test('should respect excluded paths', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_functions: 'netlify/edge-functions',
            },
          },
        })
        .withEdgeFunction({
          config: { path: '/*', excludedPath: '/static/*' },
          handler: async () => new Response('Hello world'),
          name: 'hello',
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async ({ port }) => {
        const [res1, res2] = await Promise.all([
          fetch(`http://localhost:${port}/foo`),
          fetch(`http://localhost:${port}/static/foo`),
        ])

        t.expect(res1.status).toBe(200)
        t.expect(await res1.text()).toEqual('Hello world')

        t.expect(res2.status).toBe(404)
      })
    })
  })

  test('should respect excluded paths specified in TOML', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_functions: 'netlify/edge-functions',
            },
            edge_functions: [
              {
                function: 'hello',
                path: '/*',
                excludedPath: '/static/*',
              },
            ],
          },
        })
        .withEdgeFunction({
          handler: async () => new Response('Hello world'),
          name: 'hello',
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async ({ port }) => {
        const [res1, res2] = await Promise.all([
          fetch(`http://localhost:${port}/foo`),
          fetch(`http://localhost:${port}/static/foo`),
        ])

        t.expect(res1.status).toBe(200)
        t.expect(await res1.text()).toEqual('Hello world')

        t.expect(res2.status).toBe(404)
      })
    })
  })

  test('should respect in-source configuration from internal edge functions', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      await builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
            },
          },
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ port, waitForLogMatching }) => {
        // internal functions are cleared on startup,
        // so we create them after the dev server is up and running
        await builder
          .withEdgeFunction({
            config: { path: '/internal-1' },
            handler: async () => new Response('Hello from an internal function'),
            name: 'internal',
            path: '.netlify/edge-functions',
          })
          .build()

        const res1 = await fetch(`http://localhost:${port}/internal-1`)

        t.expect(res1.status).toBe(200)
        t.expect(await res1.text()).toEqual('Hello from an internal function')

        await waitForLogMatching('Loaded edge function', { timeout: 500 })

        await builder
          .withEdgeFunction({
            config: { path: '/internal-2' },
            handler: async () => new Response('Hello from an internal function'),
            name: 'internal',
            path: '.netlify/edge-functions',
          })
          .build()

        await waitForLogMatching('Reloaded edge function', { timeout: 500 })

        const [res2, res3] = await Promise.all([
          fetch(`http://localhost:${port}/internal-1`),
          fetch(`http://localhost:${port}/internal-2`),
        ])

        t.expect(res2.status).toBe(404)
        t.expect(res3.status).toBe(200)
        t.expect(await res3.text()).toEqual('Hello from an internal function')
      })
    })
  })

  test('Serves edge functions with import maps coming from the `functions.deno_import_map` config property and from the internal manifest', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const internalEdgeFunctionsDir = path.join('.netlify', 'edge-functions')

      await builder
        .withNetlifyToml({
          config: {
            build: {
              publish: 'public',
            },
            functions: {
              deno_import_map: 'import_map.json',
            },
          },
        })
        .withEdgeFunction({
          config: { path: '/greet' },
          handler: `import { greet } from "greeter"; export default async () => new Response(greet("Netlify"))`,
          name: 'greet',
        })
        // User-defined import map
        .withContentFiles([
          {
            content: 'export const greet = (name: string) => `Hello, ${name}!`',
            path: 'greeter.ts',
          },
          {
            content: JSON.stringify({ imports: { greeter: './greeter.ts' } }),
            path: 'import_map.json',
          },
        ])
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ port }) => {
        await builder
          .withEdgeFunction({
            handler: `import { yell } from "yeller"; export default async () => new Response(yell("Netlify"))`,
            name: 'yell',
            path: '.netlify/edge-functions',
          })
          // Internal import map
          .withContentFiles([
            {
              content: 'export const yell = (name: string) => name.toUpperCase()',
              path: path.join(internalEdgeFunctionsDir, 'util', 'yeller.ts'),
            },
            {
              content: JSON.stringify({
                functions: [{ function: 'yell', path: '/yell' }],
                import_map: 'import_map.json',
                version: 1,
              }),
              path: path.join(internalEdgeFunctionsDir, 'manifest.json'),
            },
            {
              content: JSON.stringify({ imports: { yeller: './util/yeller.ts' } }),
              path: path.join(internalEdgeFunctionsDir, 'import_map.json'),
            },
          ])
          .build()

        const [res1, res2] = await Promise.all([
          fetch(`http://localhost:${port}/greet`),
          fetch(`http://localhost:${port}/yell`),
        ])

        t.expect(res1.status).toBe(200)
        t.expect(await res1.text()).toEqual('Hello, Netlify!')
        t.expect(res2.status).toBe(200)
        t.expect(await res2.text()).toEqual('NETLIFY')
      })
    })
  })

  test('should have only allowed environment variables set', async (t) => {
    const siteInfo = {
      account_slug: 'test-account',
      id: 'site_id',
      name: 'site-name',
      build_settings: { env: {} },
    }

    const routes = [
      { path: 'sites/site_id', response: siteInfo },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
    ]
    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_functions: 'netlify/edge-functions',
            },
            edge_functions: [
              {
                function: 'env',
                path: '/env',
              },
            ],
          },
        })
        .withEdgeFunction({
          handler: async () => {
            // @ts-expect-error TS(2304) FIXME: Cannot find name 'Deno'.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const fromDenoGlobal = Deno.env.toObject() as Record<string, string>
            const fromNetlifyGlobal = Netlify.env.toObject()

            return new Response(JSON.stringify({ fromDenoGlobal, fromNetlifyGlobal }))
          },
          name: 'env',
        })
        .withContentFile({
          content: 'FROM_ENV="YAS"',
          path: '.env',
        })

      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await withDevServer(
          {
            cwd: builder.directory,
            offline: false,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_SITE_ID: 'site_id',
              NETLIFY_AUTH_TOKEN: 'fake-token',
            },
          },
          async ({ port }) => {
            const response = await fetch(`http://localhost:${port.toString()}/env`)
            const body = (await response.json()) as object[]
            const buckets = Object.values(body)
            t.expect(buckets.length).toBe(2)

            buckets.forEach((bucket) => {
              const bucketKeys = Object.keys(bucket)

              t.expect(bucketKeys.includes('DENO_REGION')).toBe(true)
              t.expect(bucket).toHaveProperty('DENO_REGION', 'local')

              t.expect(bucketKeys.includes('NETLIFY_DEV')).toBe(true)
              t.expect(bucket).toHaveProperty('NETLIFY_DEV', 'true')

              t.expect(bucketKeys.includes('FROM_ENV')).toBe(true)
              t.expect(bucket).toHaveProperty('FROM_ENV', 'YAS')

              t.expect(bucketKeys.includes('DENO_DEPLOYMENT_ID')).toBe(false)
              t.expect(bucketKeys.includes('NODE_ENV')).toBe(false)
              t.expect(bucketKeys.includes('DEPLOY_URL')).toBe(false)

              t.expect(bucketKeys.includes('URL')).toBe(true)
              t.expect(bucketKeys.includes('SITE_ID')).toBe(true)
              t.expect(bucketKeys.includes('SITE_NAME')).toBe(true)
            })
          },
        )
      })
    })
  })

  test('should inject the `NETLIFY_DEV` environment variable in the process (legacy environment variables)', async (t) => {
    const externalServerPort = await getAvailablePort()
    const externalServerPath = path.join(__dirname, '../../utils', 'external-server-cli.ts')
    const command = `tsx ${externalServerPath} ${externalServerPort.toString()}`

    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'

      await builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
            },
            dev: {
              command,
              publish: publicDir,
              targetPort: externalServerPort,
              framework: '#custom',
            },
          },
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ port }) => {
        const response = await fetch(`http://localhost:${port.toString()}/`)
        const body = await response.json()
        t.expect(body).toHaveProperty('env.NETLIFY_DEV', 'true')
      })
    })
  })

  test('should inject the `NETLIFY_DEV` environment variable in the process', async (t) => {
    const { expect } = t

    const siteInfo = {
      account_slug: 'test-account',
      build_settings: {
        env: {},
      },
      id: 'site_id',
      name: 'site-name',
    }
    const existingVar = {
      key: 'EXISTING_VAR',
      scopes: ['builds', 'functions'],
      values: [
        {
          id: '1234',
          context: 'production',
          value: 'envelope-prod-value',
        },
        {
          id: '2345',
          context: 'dev',
          value: 'envelope-dev-value',
        },
      ],
    }
    const routes = [
      { path: 'sites/site_id', response: siteInfo },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
      {
        path: 'accounts/test-account/env/EXISTING_VAR',
        response: existingVar,
      },
      {
        path: 'accounts/test-account/env',
        response: [existingVar],
      },
    ]

    const externalServerPort = await getAvailablePort()
    const externalServerPath = path.join(__dirname, '../../utils', 'external-server-cli.ts')
    const command = `tsx ${externalServerPath} ${externalServerPort.toString()}`

    await withSiteBuilder(t, async (builder) => {
      const publicDir = 'public'

      await builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
            },
            dev: {
              command,
              publish: publicDir,
              targetPort: externalServerPort,
              framework: '#custom',
            },
          },
        })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        await withDevServer(
          {
            cwd: builder.directory,
            offline: false,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_SITE_ID: 'site_id',
              NETLIFY_AUTH_TOKEN: 'fake-token',
            },
          },
          async ({ port }) => {
            const res = await fetch(`http://localhost:${port.toString()}/`)
            const body = await res.json()

            expect(body).toHaveProperty('env.NETLIFY_DEV', 'true')
          },
        )
      })
    })
  })

  test('should send form-data POST requests to framework server if no function matches', async (t) => {
    const { expect } = t

    const externalServerPort = await getAvailablePort()
    const externalServerPath = path.join(__dirname, '../../utils', 'external-server-cli.ts')
    const command = `tsx ${externalServerPath} ${externalServerPort.toString()}`

    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            dev: {
              command,
              targetPort: externalServerPort,
              framework: '#custom',
            },
          },
        })
        .build()

      await withDevServer(
        {
          cwd: builder.directory,
        },
        async ({ port }) => {
          const form = new FormData()
          form.set('foo', 'bar')
          const res = await fetch(`http://localhost:${port.toString()}/request-to-framework`, {
            method: 'POST',
            body: form,
            headers: {
              'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            },
          })
          const body = await res.json()

          expect(body).toMatchObject({ url: '/request-to-framework' })
        },
      )
    })
  })

  test('should fail in CI with multiple projects', async (t) => {
    const { expect } = t

    await withSiteBuilder(t, async (builder) => {
      await builder
        .withPackageJson({ packageJson: { name: 'main', workspaces: ['*'] } })
        .withPackageJson({ packageJson: { name: 'package1' }, pathPrefix: 'package1' })
        .withPackageJson({ packageJson: { name: 'package2' }, pathPrefix: 'package2' })
        .build()

      const asyncErrorBlock = async () => {
        const childProcess = execa(
          cliPath,
          ['dev', '--offline'],
          getExecaOptions({ cwd: builder.directory, env: { CI: 'true' } }),
        )
        await childProcess
      }

      try {
        await asyncErrorBlock()
      } catch (_err: unknown) {
        const err = _err as ExecaError

        expect(normalize(err.stderr, { duration: true, filePath: true })).toEqual(
          expect.stringContaining(
            'Projects detected: package1, package2. Configure the project you want to work with and try again. Refer to https://ntl.fyi/configure-site for more information.',
          ),
        )
        expect(err.exitCode).toBe(1)
      } finally {
        expect.assertions(2)
      }
    })
  })
})
