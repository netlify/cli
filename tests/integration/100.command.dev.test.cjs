// Handlers are meant to be async outside tests
const path = require('path')

// eslint-disable-next-line ava/use-test
const avaTest = require('ava')
const { isCI } = require('ci-info')
const dotProp = require('dot-prop')
const getAvailablePort = require('get-port')
const jwt = require('jsonwebtoken')
const { Response } = require('node-fetch')

const { withDevServer } = require('./utils/dev-server.cjs')
const got = require('./utils/got.cjs')
const { withMockApi } = require('./utils/mock-api.cjs')
const { pause } = require('./utils/pause.cjs')
const { withSiteBuilder } = require('./utils/site-builder.cjs')

const test = isCI ? avaTest.serial.bind(avaTest) : avaTest

const JWT_EXPIRY = 1_893_456_000
const getToken = ({ jwtRolePath = 'app_metadata.authorization.roles', jwtSecret = 'secret', roles }) => {
  const payload = {
    exp: JWT_EXPIRY,
    sub: '12345678',
  }
  return jwt.sign(dotProp.set(payload, jwtRolePath, roles), jwtSecret)
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
  const adminToken = getToken({ jwtSecret, jwtRolePath, roles: ['admin'] })
  const editorToken = getToken({ jwtSecret, jwtRolePath, roles: ['editor'] })

  await withDevServer({ cwd: builder.directory }, async (server) => {
    const unauthenticatedResponse = await got(`${server.url}/admin`, { throwHttpErrors: false })
    t.is(unauthenticatedResponse.statusCode, 404)
    t.is(unauthenticatedResponse.body, 'Not Found')

    const authenticatedResponse = await got(`${server.url}/admin/foo`, {
      headers: {
        cookie: `nf_jwt=${adminToken}`,
      },
    })
    t.is(authenticatedResponse.statusCode, 200)
    t.is(authenticatedResponse.body, '<html>foo</html>')

    const wrongRoleResponse = await got(`${server.url}/admin/foo`, {
      headers: {
        cookie: `nf_jwt=${editorToken}`,
      },
      throwHttpErrors: false,
    })
    t.is(wrongRoleResponse.statusCode, 404)
    t.is(wrongRoleResponse.body, 'Not Found')
  })
}

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
      const response = await got(`${server.url}/hello-world`)

      t.is(response.statusCode, 200)
      t.is(response.body, '<html>hello</html>')
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
      const response = await got(`${server.url}/.netlify/functions/hello-background`)
      t.is(response.statusCode, 202)
      t.is(response.body, '')
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
      await got(`${url}/.netlify/functions/hello-background`)

      const output = outputBuffer.toString()
      const context = JSON.parse(output.match(/__CLIENT_CONTEXT__START__(.*)__CLIENT_CONTEXT__END__/)[1])
      t.is(context.clientContext, null)
      t.is(context.identity, null)
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
        handler: () => new Response('Hello world'),
        name: 'hello',
      })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/edge-function`)

      t.is(response.statusCode, 200)
      t.is(response.body, 'Hello world')
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
              function: 'hello',
              path: '/edge-function',
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
        handler: (_, context) => context.rewrite('/goodbye'),
        name: 'hello',
      })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/edge-function`)

      t.is(response.statusCode, 200)
      t.is(response.body, '<html>goodbye</html>')
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
      const response = await got(`${server.url}/edge-function`)

      t.is(response.statusCode, 200)
      t.is(response.body, 'Hello world')
    })
  })
})

test('Serves an Edge Function that includes context with site information', async (t) => {
  await withSiteBuilder('site-with-edge-function-printing-site-info', async (builder) => {
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
        handler: async (_, context) => new Response(JSON.stringify(context.site)),
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
          const response = await got(`${server.url}`)

          t.is(response.statusCode, 200)
          t.is(response.body, '{"id":"site_id","name":"site-name","url":"site-url"}')
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
      const response = await got(`${server.url}/hello`)

      t.is(response.statusCode, 200)
      t.is(response.body, '<HTML>HELLO</HTML>')
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
          // eslint-disable-next-line no-undef -- `ReadableStream` is a global in Deno
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

      await new Promise((resolve, reject) => {
        const stream = got.stream(`${server.url}/stream`)
        stream.on('data', () => {
          numberOfChunks += 1
        })
        stream.on('end', resolve)
        stream.on('error', reject)
      })

      // streamed responses arrive in more than one batch
      t.not(numberOfChunks, 1)
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
      const response = await got(`${server.url}/`, {
        headers: {
          cookie: `nf_country=ES`,
        },
      })
      t.is(response.statusCode, 200)
      t.is(response.body, '<html>index in spanish</html>')
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
      const response = await got(`${server.url}/`)
      t.is(response.statusCode, 200)
      t.is(response.body, '<html>index</html>')
    })

    await withDevServer({ cwd: builder.directory, args: ['--country=ES'] }, async (server) => {
      const response = await got(`${server.url}/`)
      t.is(response.statusCode, 200)
      t.is(response.body, '<html>index in spanish</html>')
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
      const response = await got(`${url.replace(port, functionsPort)}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
        throwHttpErrors: false,
      })
      t.is(response.statusCode, 404)
      t.is(response.body, 'Function not found...')
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
      const response = await got(`${url.replace(port, functionsPort)}/exclamat!on`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
        throwHttpErrors: false,
      })
      t.is(response.statusCode, 400)
      t.is(response.body, 'Function name should consist only of alphanumeric characters, hyphen & underscores.')
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
      const helloWorldMessage = await got(`http://localhost:${port}/hello`).then((response) => response.body)

      await builder
        .withEdgeFunction({
          handler: () => new Response('Hello builder'),
          name: 'hello',
        })
        .buildAsync()

      const DETECT_FILE_CHANGE_DELAY = 500
      await pause(DETECT_FILE_CHANGE_DELAY)

      const helloBuilderMessage = await got(`http://localhost:${port}/hello`).then((response) => response.body)

      t.is(helloWorldMessage, 'Hello world')
      t.is(helloBuilderMessage, 'Hello builder')
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
      const authResponseMessage = await got(`http://localhost:${port}/auth`).then((response) => response.body)

      await builder
        .withoutFile({
          path: 'netlify/edge-functions/auth.js',
        })
        .buildAsync()

      const DETECT_FILE_CHANGE_DELAY = 500
      await pause(DETECT_FILE_CHANGE_DELAY)

      const authNotFoundMessage = await got(`http://localhost:${port}/auth`, { throwHttpErrors: false }).then(
        (response) => response.body,
      )

      t.is(authResponseMessage, 'Auth response')
      t.is(authNotFoundMessage, '404 Not Found')
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
      const res1 = await got(`http://localhost:${port}/hello-1`, { throwHttpErrors: false })

      t.is(res1.statusCode, 200)
      t.is(res1.body, 'Hello world')

      // wait for file watcher to be up and running, which might take a little
      // if we do not wait, the next file change will not be picked up
      await pause(500)

      await builder
        .withEdgeFunction({
          config: { path: '/hello-2' },
          handler: () => new Response('Hello world'),
          name: 'hello',
        })
        .buildAsync()

      await waitForLogMatching('Reloaded edge function')

      const res2 = await got(`http://localhost:${port}/hello-1`, { throwHttpErrors: false })

      t.is(res2.statusCode, 404)

      const res3 = await got(`http://localhost:${port}/hello-2`, { throwHttpErrors: false })

      t.is(res3.statusCode, 200)
      t.is(res3.body, 'Hello world')
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
      const res1 = await got(`http://localhost:${port}/foo`, { throwHttpErrors: false })

      t.is(res1.statusCode, 200)
      t.is(res1.body, 'Hello world')

      const res2 = await got(`http://localhost:${port}/static/foo`, { throwHttpErrors: false })
      t.is(res2.statusCode, 404)
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
      const res1 = await got(`http://localhost:${port}/internal-1`, { throwHttpErrors: false })

      t.is(res1.statusCode, 200)
      t.is(res1.body, 'Hello from an internal function')

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

      const res2 = await got(`http://localhost:${port}/internal-1`, { throwHttpErrors: false })

      t.is(res2.statusCode, 404)

      const res3 = await got(`http://localhost:${port}/internal-2`, { throwHttpErrors: false })

      t.is(res3.statusCode, 200)
      t.is(res3.body, 'Hello from an internal function')
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
      const res1 = await got(`http://localhost:${port}/greet`, { throwHttpErrors: false })

      t.is(res1.statusCode, 200)
      t.is(res1.body, 'Hello, Netlify!')

      const res2 = await got(`http://localhost:${port}/yell`, { throwHttpErrors: false })

      t.is(res2.statusCode, 200)
      t.is(res2.body, 'NETLIFY')
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
        SECRET_ENV: 'true',
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
        // eslint-disable-next-line no-undef
        handler: () => new Response(`${JSON.stringify(Deno.env.toObject())}`),
        name: 'env',
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
          const response = await got(`http://localhost:${port}/env`).then((edgeResponse) =>
            JSON.parse(edgeResponse.body),
          )
          const envKeys = Object.keys(response)

          t.false(envKeys.includes('DENO_DEPLOYMENT_ID'))
          // t.true(envKeys.includes('DENO_DEPLOYMENT_ID'))
          // t.is(response.DENO_DEPLOYMENT_ID, 'xxx=')
          t.true(envKeys.includes('DENO_REGION'))
          t.is(response.DENO_REGION, 'local')
          t.true(envKeys.includes('NETLIFY_DEV'))
          t.is(response.NETLIFY_DEV, 'true')
          t.true(envKeys.includes('SECRET_ENV'))
          t.is(response.SECRET_ENV, 'true')

          t.false(envKeys.includes('NODE_ENV'))
          t.false(envKeys.includes('DEPLOY_URL'))
          t.false(envKeys.includes('URL'))
        },
      )
    })
  })
})

test('should inject the `NETLIFY_DEV` environment variable in the process (legacy environment variables)', async (t) => {
  const externalServerPort = await getAvailablePort()
  const externalServerPath = path.join(__dirname, 'utils', 'external-server-cli.cjs')
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
      const response = await got(`http://localhost:${port}/`).json()

      t.is(response.env.NETLIFY_DEV, 'true')
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
  const externalServerPath = path.join(__dirname, 'utils', 'external-server-cli.cjs')
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
          const response = await got(`http://localhost:${port}/`).json()

          t.is(response.env.NETLIFY_DEV, 'true')
        },
      )
    })
  })
})
