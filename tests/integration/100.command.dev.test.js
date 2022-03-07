// Handlers are meant to be async outside tests
/* eslint-disable require-await */
const path = require('path')

// eslint-disable-next-line ava/use-test
const avaTest = require('ava')
const { isCI } = require('ci-info')
const dotProp = require('dot-prop')
const jwt = require('jsonwebtoken')

const { withDevServer } = require('./utils/dev-server')
const got = require('./utils/got')
const { withSiteBuilder } = require('./utils/site-builder')

const test = isCI ? avaTest.serial.bind(avaTest) : avaTest

const testMatrix = [
  { args: [] },

  // some tests are still failing with this enabled
  // { args: ['--edgeHandlers'] }
]

const testName = (title, args) => (args.length <= 0 ? title : `${title} - ${args.join(' ')}`)

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

const validateRoleBasedRedirectsSite = async ({ args, builder, jwtRolePath, jwtSecret, t }) => {
  const adminToken = getToken({ jwtSecret, jwtRolePath, roles: ['admin'] })
  const editorToken = getToken({ jwtSecret, jwtRolePath, roles: ['editor'] })

  await withDevServer({ cwd: builder.directory, args }, async (server) => {
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

testMatrix.forEach(({ args }) => {
  test(testName('should follow redirect for fully qualified rule', args), async (t) => {
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

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/hello-world`)

        t.is(response.statusCode, 200)
        t.is(response.body, '<html>hello</html>')
      })
    })
  })

  test(testName('should return 202 ok and empty response for background function', args), async (t) => {
    await withSiteBuilder('site-with-background-function', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withFunction({
        path: 'hello-background.js',
        handler: () => {
          console.log("Look at me I'm a background task")
        },
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await got(`${server.url}/.netlify/functions/hello-background`)
        t.is(response.statusCode, 202)
        t.is(response.body, '')
      })
    })
  })

  test(testName('background function clientContext,identity should be null', args), async (t) => {
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

      await withDevServer({ cwd: builder.directory, args }, async ({ outputBuffer, url }) => {
        await got(`${url}/.netlify/functions/hello-background`)

        const output = outputBuffer.toString()
        const context = JSON.parse(output.match(/__CLIENT_CONTEXT__START__(.*)__CLIENT_CONTEXT__END__/)[1])
        t.is(context.clientContext, null)
        t.is(context.identity, null)
      })
    })
  })

  test(testName('should enforce role based redirects with default secret and role path', args), async (t) => {
    await withSiteBuilder('site-with-default-role-based-redirects', async (builder) => {
      setupRoleBasedRedirectsSite(builder)
      await builder.buildAsync()
      await validateRoleBasedRedirectsSite({ builder, args, t })
    })
  })

  test(testName('should enforce role based redirects with custom secret and role path', args), async (t) => {
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
      await validateRoleBasedRedirectsSite({ builder, args, t, jwtSecret, jwtRolePath })
    })
  })

  test(testName('routing-local-proxy serves edge handlers with --edgeHandlers flag', args), async (t) => {
    await withSiteBuilder('site-with-fully-qualified-redirect-rule', async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_handlers: 'netlify/edge-handlers',
            },
            'edge-handlers': [
              {
                handler: 'smoke',
                path: '/edge-handler',
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
        .withEdgeHandlers({
          fileName: 'smoke.js',
          handlers: {
            onRequest: (event) => {
              event.replaceResponse(
                // eslint-disable-next-line no-undef
                new Response(null, {
                  headers: {
                    Location: 'https://google.com/',
                  },
                  status: 301,
                }),
              )
            },
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args: [...args, '--edgeHandlers'] }, async (server) => {
        const response = await got(`${server.url}/edge-handler`, {
          followRedirect: false,
        })

        t.is(response.statusCode, 301)
        t.is(response.headers.location, 'https://google.com/')
      })
    })
  })

  test(testName('routing-local-proxy serves edge handlers with deprecated --trafficMesh flag', args), async (t) => {
    await withSiteBuilder('site-with-fully-qualified-redirect-rule', async (builder) => {
      const publicDir = 'public'
      builder
        .withNetlifyToml({
          config: {
            build: {
              publish: publicDir,
              edge_handlers: 'netlify/edge-handlers',
            },
            'edge-handlers': [
              {
                handler: 'smoke',
                path: '/edge-handler',
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
        .withEdgeHandlers({
          fileName: 'smoke.js',
          handlers: {
            onRequest: (event) => {
              event.replaceResponse(
                // eslint-disable-next-line no-undef
                new Response(null, {
                  headers: {
                    Location: 'https://google.com/',
                  },
                  status: 301,
                }),
              )
            },
          },
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args: [...args, '--trafficMesh'] }, async (server) => {
        const response = await got(`${server.url}/edge-handler`, {
          followRedirect: false,
        })

        t.is(response.statusCode, 301)
        t.is(response.headers.location, 'https://google.com/')
      })
    })
  })

  test(testName('routing-local-proxy builds projects w/o edge handlers', args), async (t) => {
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
        ])

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args: [...args, '--edgeHandlers'] }, async (server) => {
        const response = await got(`${server.url}/index.html`)

        t.is(response.statusCode, 200)
      })
    })
  })

  test(testName('redirect with country cookie', args), async (t) => {
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

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
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

  test(testName(`doesn't hang when sending a application/json POST request to function server`, args), async (t) => {
    await withSiteBuilder('site-with-functions', async (builder) => {
      const functionsPort = 6666
      await builder
        .withNetlifyToml({ config: { functions: { directory: 'functions' }, dev: { functionsPort } } })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async ({ port, url }) => {
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

  test(testName(`catches invalid function names`, args), async (t) => {
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

      await withDevServer({ cwd: builder.directory, args }, async ({ port, url }) => {
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
})
/* eslint-enable require-await */
