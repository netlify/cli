// Handlers are meant to be async outside tests
const { promises: fs } = require('fs')
const { join } = require('path')

// eslint-disable-next-line ava/use-test
const avaTest = require('ava')
const { isCI } = require('ci-info')
const jwt = require('jsonwebtoken')
const fetch = require('node-fetch')

const { withDevServer } = require('./utils/dev-server.cjs')
const { startExternalServer } = require('./utils/external-server.cjs')
const got = require('./utils/got.cjs')
const { withMockApi } = require('./utils/mock-api.cjs')
const { withSiteBuilder } = require('./utils/site-builder.cjs')

const test = isCI ? avaTest.serial.bind(avaTest) : avaTest

test('should return 404.html if exists for non existing routes', async (t) => {
  await withSiteBuilder('site-with-shadowing-404', async (builder) => {
    builder.withContentFile({
      path: '404.html',
      content: '<h1>404 - Page not found</h1>',
    })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/non-existent`, { throwHttpErrors: false })
      t.is(response.headers.etag, undefined)
      t.is(response.body, '<h1>404 - Page not found</h1>')
    })
  })
})

test('should return 404.html from publish folder if exists for non existing routes', async (t) => {
  await withSiteBuilder('site-with-shadowing-404-in-publish-folder', async (builder) => {
    builder
      .withContentFile({
        path: 'public/404.html',
        content: '<h1>404 - My Custom 404 Page</h1>',
      })
      .withNetlifyToml({
        config: {
          build: {
            publish: 'public/',
          },
        },
      })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/non-existent`, { throwHttpErrors: false })
      t.is(response.statusCode, 404)
      t.is(response.headers.etag, undefined)
      t.is(response.body, '<h1>404 - My Custom 404 Page</h1>')
    })
  })
})

test('should return 404 for redirect', async (t) => {
  await withSiteBuilder('site-with-shadowing-404-redirect', async (builder) => {
    builder
      .withContentFile({
        path: 'foo.html',
        content: '<html><h1>foo',
      })
      .withNetlifyToml({
        config: {
          redirects: [{ from: '/test-404', to: '/foo', status: 404 }],
        },
      })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/test-404`, { throwHttpErrors: false })
      t.truthy(response.headers.etag)
      t.is(response.statusCode, 404)
      t.is(response.body, '<html><h1>foo')
    })
  })
})

test('should ignore 404 redirect for existing file', async (t) => {
  await withSiteBuilder('site-with-shadowing-404-redirect-existing', async (builder) => {
    builder
      .withContentFile({
        path: 'foo.html',
        content: '<html><h1>foo',
      })
      .withContentFile({
        path: 'test-404.html',
        content: '<html><h1>This page actually exists',
      })
      .withNetlifyToml({
        config: {
          redirects: [{ from: '/test-404', to: '/foo', status: 404 }],
        },
      })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/test-404`)

      t.is(response.statusCode, 200)
      t.is(response.body, '<html><h1>This page actually exists')
    })
  })
})

test('should follow 404 redirect even with existing file when force=true', async (t) => {
  await withSiteBuilder('site-with-shadowing-404-redirect-force', async (builder) => {
    builder
      .withContentFile({
        path: 'foo.html',
        content: '<html><h1>foo',
      })
      .withContentFile({
        path: 'test-404.html',
        content: '<html><h1>This page actually exists',
      })
      .withNetlifyToml({
        config: {
          redirects: [{ from: '/test-404', to: '/foo', status: 404, force: true }],
        },
      })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/test-404`, { throwHttpErrors: false })

      t.is(response.statusCode, 404)
      t.is(response.body, '<html><h1>foo')
    })
  })
})

test('should source redirects file from publish directory', async (t) => {
  await withSiteBuilder('site-redirects-file-inside-publish', async (builder) => {
    builder
      .withContentFile({
        path: 'public/index.html',
        content: 'index',
      })
      .withRedirectsFile({
        pathPrefix: 'public',
        redirects: [{ from: '/*', to: `/index.html`, status: 200 }],
      })
      .withNetlifyToml({
        config: {
          build: { publish: 'public' },
        },
      })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/test`)

      t.is(response.statusCode, 200)
      t.is(response.body, 'index')
    })
  })
})

test('should rewrite requests to an external server', async (t) => {
  await withSiteBuilder('site-redirects-file-to-external', async (builder) => {
    const externalServer = startExternalServer()
    const { port } = externalServer.address()
    builder.withRedirectsFile({
      redirects: [{ from: '/api/*', to: `http://localhost:${port}/:splat`, status: 200 }],
    })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const getResponse = await got(`${server.url}/api/ping`).json()
      t.deepEqual(getResponse.body, {})
      t.is(getResponse.method, 'GET')
      t.is(getResponse.url, '/ping')

      const postResponse = await got
        .post(`${server.url}/api/ping`, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'param=value',
          followRedirect: false,
        })
        .json()
      t.deepEqual(postResponse.body, { param: 'value' })
      t.is(postResponse.method, 'POST')
      t.is(postResponse.url, '/ping')
    })

    externalServer.close()
  })
})

test('should sign external redirects with the `x-nf-sign` header when a `signed` value is set', async (t) => {
  await withSiteBuilder('site-redirects-file-to-external', async (builder) => {
    const mockSigningSecret = 'iamverysecret'
    const externalServer = startExternalServer()
    const { port } = externalServer.address()
    const siteInfo = {
      account_slug: 'test-account',
      id: 'site_id',
      name: 'site-name',
      url: 'https://cli-test-suite.netlify.ftw',
    }
    const routes = [
      { path: 'sites/site_id', response: siteInfo },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
    ]

    await builder
      .withNetlifyToml({
        config: {
          build: { environment: { VAR_WITH_SIGNING_SECRET: mockSigningSecret } },
          redirects: [
            { from: '/sign/*', to: `http://localhost:${port}/:splat`, signed: 'VAR_WITH_SIGNING_SECRET', status: 200 },
          ],
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
            NETLIFY_SITE_ID: siteInfo.id,
            NETLIFY_AUTH_TOKEN: 'fake-token',
          },
        },
        async (server) => {
          const getResponse = await got(`${server.url}/sign/ping`).json()
          const postResponse = await got
            .post(`${server.url}/sign/ping`, {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: 'param=value',
              followRedirect: false,
            })
            .json()

          ;[getResponse, postResponse].forEach((response) => {
            const signature = response.headers['x-nf-sign']
            const payload = jwt.verify(signature, mockSigningSecret)

            t.is(payload.deploy_context, 'dev')
            t.is(payload.netlify_id, siteInfo.id)
            t.is(payload.site_url, siteInfo.url)
            t.is(payload.iss, 'netlify')
          })

          t.deepEqual(postResponse.body, { param: 'value' })
        },
      )
    })

    externalServer.close()
  })
})

test('should follow 301 redirect to an external server', async (t) => {
  await withSiteBuilder('site-redirects-file-to-external-301', async (builder) => {
    const externalServer = startExternalServer()
    const { port } = externalServer.address()
    builder.withRedirectsFile({
      redirects: [{ from: '/api/*', to: `http://localhost:${port}/:splat`, status: 301 }],
    })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response1 = await got(`${server.url}/api/ping`, { followRedirect: false })
      t.is(response1.headers.location, `http://localhost:${port}/ping`)

      const response2 = await got(`${server.url}/api/ping`).json()
      t.deepEqual(response2.body, {})
      t.is(response2.method, 'GET')
      t.is(response2.url, '/ping')
    })

    externalServer.close()
  })
})

test('should rewrite POST request if content-type is missing and not crash dev server', async (t) => {
  await withSiteBuilder('site-with-post-no-content-type', async (builder) => {
    builder.withNetlifyToml({
      config: {
        functions: { directory: 'functions' },
        redirects: [{ from: '/api/*', to: '/other/:splat', status: 200 }],
      },
    })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const error = await t.throwsAsync(
        async () =>
          await got.post(`${server.url}/api/echo`, {
            body: 'param=value',
            followRedirect: false,
          }),
      )

      // Method Not Allowed
      t.is(error.response.statusCode, 405)
    })
  })
})

test('should return .html file when file and folder have the same name', async (t) => {
  await withSiteBuilder('site-with-same-name-for-file-and-folder', async (builder) => {
    builder
      .withContentFile({
        path: 'foo.html',
        content: '<html><h1>foo',
      })
      .withContentFile({
        path: 'foo/file.html',
        content: '<html><h1>file in folder',
      })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const response = await got(`${server.url}/foo`)

      t.is(response.statusCode, 200)
      t.is(response.body, '<html><h1>foo')
    })
  })
})

test('should not shadow an existing file that has unsafe URL characters', async (t) => {
  await withSiteBuilder('site-with-unsafe-url-file-names', async (builder) => {
    builder
      .withContentFile({
        path: 'public/index.html',
        content: '<html>index</html>',
      })
      .withContentFile({
        path: 'public/files/file with spaces.html',
        content: '<html>file with spaces</html>',
      })
      .withContentFile({
        path: 'public/files/[file_with_brackets].html',
        content: '<html>file with brackets</html>',
      })
      .withNetlifyToml({
        config: {
          build: { publish: 'public' },
          redirects: [{ from: '/*', to: '/index.html', status: 200 }],
        },
      })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const [spaces, brackets] = await Promise.all([
        got(`${server.url}/files/file with spaces`).text(),
        got(`${server.url}/files/[file_with_brackets]`).text(),
      ])

      t.is(spaces, '<html>file with spaces</html>')
      t.is(brackets, '<html>file with brackets</html>')
    })
  })
})

test('should generate an ETag for static assets', async (t) => {
  await withSiteBuilder('site-with-static-assets', async (builder) => {
    builder
      .withContentFile({
        path: 'public/index.html',
        content: '<html>index</html>',
      })
      .withNetlifyToml({
        config: {
          build: { publish: 'public' },
          redirects: [{ from: '/*', to: '/index.html', status: 200 }],
        },
      })

    await builder.buildAsync()

    await withDevServer({ cwd: builder.directory }, async (server) => {
      const res1 = await fetch(`${server.url}`)
      const etag = res1.headers.get('etag')

      t.truthy(etag)
      t.is(res1.status, 200)
      t.truthy(await res1.text())

      const res2 = await fetch(`${server.url}`, {
        headers: {
          'if-none-match': etag,
        },
      })

      t.is(res2.status, 304)
      t.falsy(await res2.text())

      const res3 = await fetch(`${server.url}`, {
        headers: {
          'if-none-match': 'stale-etag',
        },
      })

      t.truthy(res3.headers.get('etag'))
      t.is(res3.status, 200)
      t.truthy(await res3.text())
    })
  })
})

test('should add `.netlify` to an existing `.gitignore` file', async (t) => {
  await withSiteBuilder('site-with-gitignore', async (builder) => {
    const existingGitIgnore = ['.vscode/', 'node_modules/', '!node_modules/cool_module']

    await builder
      .withContentFile({
        path: '.gitignore',
        content: existingGitIgnore.join('\n'),
      })
      .withContentFile({
        path: 'index.html',
        content: '<html><h1>Hi',
      })
      .buildAsync()

    await withDevServer({ cwd: builder.directory }, async () => {
      const gitignore = await fs.readFile(join(builder.directory, '.gitignore'), 'utf8')
      const entries = gitignore.split('\n')

      t.true(entries.includes('.netlify'))
    })
  })
})

test('should create a `.gitignore` file with `.netlify`', async (t) => {
  await withSiteBuilder('site-with-no-gitignore', async (builder) => {
    await builder
      .withContentFile({
        path: 'index.html',
        content: '<html><h1>Hi',
      })
      .buildAsync()

    await withDevServer({ cwd: builder.directory }, async () => {
      const gitignore = await fs.readFile(join(builder.directory, '.gitignore'), 'utf8')
      const entries = gitignore.split('\n')

      t.true(entries.includes('.netlify'))
    })
  })
})
