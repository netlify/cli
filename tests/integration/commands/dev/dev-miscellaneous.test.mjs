import path from 'path'
import { fileURLToPath } from 'url'

import { setProperty } from 'dot-prop'
import getAvailablePort from 'get-port'
import jwt from 'jsonwebtoken'
import fetch from 'node-fetch'
import { describe, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.cjs'
import got from '../../utils/got.cjs'
import { withMockApi } from '../../utils/mock-api.cjs'
import { pause } from '../../utils/pause.cjs'
import { withSiteBuilder } from '../../utils/site-builder.cjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const JWT_EXPIRY = 1_893_456_000
const getToken = async ({ jwtRolePath = 'app_metadata.authorization.roles', jwtSecret = 'secret', roles }) => {
  const payload = {
    exp: JWT_EXPIRY,
    sub: '12345678',
  }
  return jwt.sign(setProperty(payload, jwtRolePath, roles), jwtSecret)
}

const setupRoleBasedRedirectsSite = (builder) => {
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

const validateRoleBasedRedirectsSite = async ({ builder, jwtRolePath, jwtSecret, t }) => {
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
    await withSiteBuilder('site-with-fully-qualified-redirect-rule', async (builder) => {
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

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/hello-world`)

        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('<html>hello</html>')
      })
    })
  })

  test('should return 202 ok and empty response for background function', async (t) => {
    await withSiteBuilder('site-with-background-function', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'hello-background.js',
        handler: () => {
          console.log("Look at me I'm a background task")
        },
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/.netlify/functions/hello-background`)
        t.expect(response.status).toBe(202)
        t.expect(await response.text()).toEqual('')
      })
    })
  })

  test('background function clientContext,identity should be null', async (t) => {
    await withSiteBuilder('site-with-background-function', async (builder) => {
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
        .withFunction({
          path: 'hello-background.js',
          handler: (_, context) => {
            console.log(`__CLIENT_CONTEXT__START__${JSON.stringify(context)}__CLIENT_CONTEXT__END__`)
          },
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ outputBuffer, url }) => {
        await fetch(`${url}/.netlify/functions/hello-background`)

        const output = outputBuffer.toString()
        const context = JSON.parse(output.match(/__CLIENT_CONTEXT__START__(.*)__CLIENT_CONTEXT__END__/)[1])
        t.expect(context.clientContext).toBe(null)
        t.expect(context.identity).toBe(null)
      })
    })
  })

  test('should enforce role based redirects with default secret and role path', async (t) => {
    await withSiteBuilder('site-with-default-role-based-redirects', async (builder) => {
      setupRoleBasedRedirectsSite(builder)
      await builder.buildAsync()
      await validateRoleBasedRedirectsSite({ builder, t })
    })
  })

  test('should enforce role based redirects with custom secret and role path', async (t) => {
    await withSiteBuilder('site-with-custom-role-based-redirects', async (builder) => {
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
      await builder.buildAsync()
      await validateRoleBasedRedirectsSite({ builder, t, jwtSecret, jwtRolePath })
    })
  })

  test('Serves an Edge Function that terminates a response', async (t) => {
    await withSiteBuilder('site-with-edge-function-that-terminates-response', async (builder) => {
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
          handler: (req) => new Response(req.headers.get('x-nf-request-id')),
          name: 'hello',
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/edge-function`)
        const responseBody = await response.text()

        t.expect(response.status).toBe(200)
        t.expect(responseBody.length).toBe(26)
        t.expect(responseBody).toEqual(response.headers.get('x-nf-request-id'))
      })
    })
  })

  test('Serves an Edge Function with a rewrite', async (t) => {
    await withSiteBuilder('site-with-edge-function-that-rewrites', async (builder) => {
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
          handler: async (_, context) => {
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
          handler: (req) => new URL('/goodbye', req.url),
          name: 'hello',
        })

      await builder.buildAsync()

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
    await withSiteBuilder('site-with-edge-function-with-caching', async (builder) => {
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
          handler: () => new Response('Hello world'),
          name: 'hello',
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/edge-function`)

        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('Hello world')
      })
    })
  })

  test('Serves an Edge Function that includes context with site and deploy information', async (t) => {
    await withSiteBuilder('site-with-edge-function-printing-site-deploy-info', async (builder) => {
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
            return new Response(JSON.stringify({ deploy, site }))
          },
          name: 'siteContext',
        })

      await builder.buildAsync()

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
            const response = await fetch(`${server.url}`)

            t.expect(response.status).toBe(200)
            t.expect(JSON.parse(await response.text())).toStrictEqual({
              deploy: { id: '0' },
              site: { id: 'site_id', name: 'site-name', url: 'site-url' },
            })
          },
        )
      })
    })
  })

  test('Serves an Edge Function that transforms the response', async (t) => {
    await withSiteBuilder('site-with-edge-function-that-transforms-response', async (builder) => {
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
            const resp = await context.next()
            const text = await resp.text()

            return new Response(text.toUpperCase(), resp)
          },
          name: 'yell',
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/hello`)

        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('<HTML>HELLO</HTML>')
      })
    })
  })

  test('Serves an Edge Function that streams the response', async (t) => {
    await withSiteBuilder('site-with-edge-function-that-streams-response', async (builder) => {
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
                  const msg = new TextEncoder().encode(`${Date.now()}\r\n`)
                  controller.enqueue(msg)
                }, 100)

                setTimeout(() => {
                  controller.close()
                }, 500)
              },
            })

            return new Response(body, {
              headers: {
                'content-type': 'text/event-stream',
              },
              status: 200,
            })
          },
          name: 'stream',
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        let numberOfChunks = 0

        // eslint-disable-next-line no-async-promise-executor
        await new Promise(async (resolve, reject) => {
          const stream = await fetch(`${server.url}/stream`).then((response) => response.body)
          stream.on('data', () => {
            numberOfChunks += 1
          })
          stream.on('end', resolve)
          stream.on('error', reject)
        })

        // streamed responses arrive in more than one batch
        t.expect(numberOfChunks).not.toBe(1)
      })
    })
  })

  test('When an edge function fails, serves a fallback defined by its `on_error` mode', async (t) => {
    await withSiteBuilder('site-with-edge-function-that-fails', async (builder) => {
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
          config: { onError: 'bypass', path: '/hello-1' },
          handler: () => {
            // eslint-disable-next-line no-undef
            ermThisWillFail()

            return new Response('I will never get here')
          },
          name: 'hello-1',
        })
        .withEdgeFunction({
          config: { onError: '/error-page', path: '/hello-2' },
          handler: () => {
            // eslint-disable-next-line no-undef
            ermThisWillFail()

            return new Response('I will never get here')
          },
          name: 'hello-2',
        })

      await builder.buildAsync()

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
    await withSiteBuilder('site-with-edge-function-uncaught-exception', async (builder) => {
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
          handler: () => {
            const url = new URL('/shouldve-provided-a-base')
            return new Response(url.toString())
          },
          name: 'hello-1',
        })

      await builder.buildAsync()

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
    await withSiteBuilder('site-with-country-cookie', async (builder) => {
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

      await builder.buildAsync()

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
    await withSiteBuilder('site-with-country-flag', async (builder) => {
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

      await builder.buildAsync()

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
    await withSiteBuilder('site-with-functions', async (builder) => {
      const functionsPort = 6666
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' }, dev: { functionsPort } } })
        .buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ port, url }) => {
        const response = await fetch(`${url.replace(port, functionsPort)}/test`, {
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
    await withSiteBuilder('site-with-functions', async (builder) => {
      const functionsPort = 6667
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' }, dev: { functionsPort } } })
        .withFunction({
          path: 'exclamat!on.js',
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ port, url }) => {
        const response = await fetch(`${url.replace(port, functionsPort)}/exclamat!on`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: '{}',
        })
        t.expect(response.status).toBe(400)
        t.expect(await response.text()).toEqual(
          'Function name should consist only of alphanumeric characters, hyphen & underscores.',
        )
      })
    })
  })

  test('should detect content changes in edge functions', async (t) => {
    await withSiteBuilder('site-with-edge-functions', async (builder) => {
      const publicDir = 'public'
      await builder
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
          handler: () => new Response('Hello world'),
          name: 'hello',
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ port }) => {
        const helloWorldMessage = await got(`http://localhost:${port}/hello`).then((res) => res.body)

        await builder
          .withEdgeFunction({
            handler: () => new Response('Hello builder'),
            name: 'hello',
          })
          .buildAsync()

        const DETECT_FILE_CHANGE_DELAY = 500
        await pause(DETECT_FILE_CHANGE_DELAY)

        const helloBuilderMessage = await got(`http://localhost:${port}/hello`).then((res) => res.body)

        t.expect(helloWorldMessage).toEqual('Hello world')
        t.expect(helloBuilderMessage).toEqual('Hello builder')
      })
    })
  })

  test('should detect deleted edge functions', async (t) => {
    await withSiteBuilder('site-with-edge-functions', async (builder) => {
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
          handler: () => new Response('Auth response'),
          name: 'auth',
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ port }) => {
        const authResponseMessage = await fetch(`http://localhost:${port}/auth`).then((response) => response.text())

        await builder
          .withoutFile({
            path: 'netlify/edge-functions/auth.js',
          })
          .buildAsync()

        const DETECT_FILE_CHANGE_DELAY = 500
        await pause(DETECT_FILE_CHANGE_DELAY)

        const authNotFoundMessage = await fetch(`http://localhost:${port}/auth`).then((response) => response.text())

        t.expect(authResponseMessage).toEqual('Auth response')
        t.expect(authNotFoundMessage).toEqual('404 Not Found')
      })
    })
  })

  test('should respect in-source configuration from edge functions', async (t) => {
    await withSiteBuilder('site-with-edge-functions', async (builder) => {
      const publicDir = 'public'
      await builder
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
          handler: () => new Response('Hello world'),
          name: 'hello',
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ port, waitForLogMatching }) => {
        const res1 = await fetch(`http://localhost:${port}/hello-1`)

        t.expect(res1.status).toBe(200)
        t.expect(await res1.text()).toEqual('Hello world')

        // wait for file watcher to be up and running, which might take a little
        // if we do not wait, the next file change will not be picked up
        await pause(500)

        await builder
          .withEdgeFunction({
            config: { path: ['/hello-2', '/hello-3'] },
            handler: () => new Response('Hello world'),
            name: 'hello',
          })
          .buildAsync()

        await waitForLogMatching('Reloaded edge function')

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
    await withSiteBuilder('site-with-excluded-path', async (builder) => {
      const publicDir = 'public'
      await builder
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
          handler: () => new Response('Hello world'),
          name: 'hello',
        })

      await builder.buildAsync()

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
    await withSiteBuilder('site-with-internal-edge-functions', async (builder) => {
      const publicDir = 'public'
      await builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
            },
          },
        })
        .withEdgeFunction({
          config: { path: '/internal-1' },
          handler: () => new Response('Hello from an internal function'),
          internal: true,
          name: 'internal',
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ port, waitForLogMatching }) => {
        const res1 = await fetch(`http://localhost:${port}/internal-1`)

        t.expect(res1.status).toBe(200)
        t.expect(await res1.text()).toEqual('Hello from an internal function')

        // wait for file watcher to be up and running, which might take a little
        // if we do not wait, the next file change will not be picked up
        await pause(500)

        await builder
          .withEdgeFunction({
            config: { path: '/internal-2' },
            handler: () => new Response('Hello from an internal function'),
            internal: true,
            name: 'internal',
          })
          .buildAsync()

        await waitForLogMatching('Reloaded edge function')

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
    await withSiteBuilder('site-with-edge-functions-and-import-maps', async (builder) => {
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
        .withEdgeFunction({
          handler: `import { yell } from "yeller"; export default async () => new Response(yell("Netlify"))`,
          name: 'yell',
          internal: true,
        })
        // User-defined import map
        .withContentFiles([
          {
            // eslint-disable-next-line no-template-curly-in-string
            content: 'export const greet = (name: string) => `Hello, ${name}!`',
            path: 'greeter.ts',
          },
          {
            content: JSON.stringify({ imports: { greeter: './greeter.ts' } }),
            path: 'import_map.json',
          },
        ])
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

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ port }) => {
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
      build_settings: {
        env: {
          NETLIFY_SECRET_ENV: 'true',
        },
      },
    }

    const routes = [
      { path: 'sites/site_id', response: siteInfo },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
    ]
    await withSiteBuilder('site-with-edge-functions-and-env', async (builder) => {
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
          handler: () => {
            // eslint-disable-next-line no-undef
            const fromDenoGlobal = Deno.env.toObject()
            // eslint-disable-next-line no-undef
            const fromNetlifyGlobal = Netlify.env.toObject()

            return new Response(`${JSON.stringify({ fromDenoGlobal, fromNetlifyGlobal })}`)
          },
          name: 'env',
        })
        .withContentFile({
          content: 'FROM_ENV="YAS"',
          path: '.env',
        })

      await builder.buildAsync()

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
            const response = await fetch(`http://localhost:${port}/env`).then((res) => res.json())
            const buckets = Object.values(response)
            t.expect(buckets.length).toBe(2)

            buckets.forEach((bucket) => {
              const bucketKeys = Object.keys(bucket)

              t.expect(bucketKeys.includes('DENO_REGION')).toBe(true)
              t.expect(bucket.DENO_REGION).toEqual('local')

              t.expect(bucketKeys.includes('NETLIFY_DEV')).toBe(true)
              t.expect(bucket.NETLIFY_DEV).toEqual('true')

              t.expect(bucketKeys.includes('NETLIFY_SECRET_ENV')).toBe(true)
              t.expect(bucket.NETLIFY_SECRET_ENV).toEqual('true')

              t.expect(bucketKeys.includes('FROM_ENV')).toBe(true)
              t.expect(bucket.FROM_ENV).toEqual('YAS')

              t.expect(bucketKeys.includes('DENO_DEPLOYMENT_ID')).toBe(false)
              t.expect(bucketKeys.includes('NODE_ENV')).toBe(false)
              t.expect(bucketKeys.includes('DEPLOY_URL')).toBe(false)
              t.expect(bucketKeys.includes('URL')).toBe(false)
            })
          },
        )
      })
    })
  })

  test('should inject the `NETLIFY_DEV` environment variable in the process (legacy environment variables)', async (t) => {
    const externalServerPort = await getAvailablePort()
    const externalServerPath = path.join(__dirname, '../../utils', 'external-server-cli.cjs')
    const command = `node ${externalServerPath} ${externalServerPort}`

    await withSiteBuilder('site-with-legacy-env-vars', async (builder) => {
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
        .buildAsync()

      await withDevServer({ cwd: builder.directory }, async ({ port }) => {
        const response = await fetch(`http://localhost:${port}/`).then((res) => res.json())
        t.expect(response.env.NETLIFY_DEV).toEqual('true')
      })
    })
  })

  test('should inject the `NETLIFY_DEV` environment variable in the process', async (t) => {
    const siteInfo = {
      account_slug: 'test-account',
      build_settings: {
        env: {},
      },
      id: 'site_id',
      name: 'site-name',
      use_envelope: true,
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
    const externalServerPath = path.join(__dirname, '../../utils', 'external-server-cli.cjs')
    const command = `node ${externalServerPath} ${externalServerPort}`

    await withSiteBuilder('site-with-env-vars', async (builder) => {
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
        .buildAsync()

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
            const response = await fetch(`http://localhost:${port}/`).then((res) => res.json())
            t.expect(response.env.NETLIFY_DEV).toEqual('true')
          },
        )
      })
    })
  })
})
