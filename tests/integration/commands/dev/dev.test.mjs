// Handlers are meant to be async outside tests
import fs from 'fs/promises'
import { join } from 'path'

import jwt from 'jsonwebtoken'
import { describe, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.mjs'
import { startExternalServer } from '../../utils/external-server.mjs'
import { withMockApi } from '../../utils/mock-api.mjs'
import { withSiteBuilder } from '../../utils/site-builder.mjs'

describe.concurrent('command/dev', () => {
  test('should return 404.html if exists for non existing routes', async (t) => {
    await withSiteBuilder('site-with-shadowing-404', async (builder) => {
      builder.withContentFile({
        path: '404.html',
        content: '<h1>404 - Page not found</h1>',
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/non-existent`)
        t.expect(response.headers.get('etag')).toBe(null)
        t.expect(await response.text()).toEqual('<h1>404 - Page not found</h1>')
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
        const response = await fetch(`${server.url}/non-existent`)
        t.expect(response.status).toBe(404)
        t.expect(response.headers.get('etag')).toBe(null)
        t.expect(await response.text()).toEqual('<h1>404 - My Custom 404 Page</h1>')
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
        const response = await fetch(`${server.url}/test-404`)
        t.expect(response.headers.get('etag')).toBeTruthy()
        t.expect(response.status).toBe(404)
        t.expect(await response.text()).toEqual('<html><h1>foo')
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
        const response = await fetch(`${server.url}/test-404`)

        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('<html><h1>This page actually exists')
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
        const response = await fetch(`${server.url}/test-404`)

        t.expect(response.status).toBe(404)
        t.expect(await response.text()).toEqual('<html><h1>foo')
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
        const response = await fetch(`${server.url}/test`)

        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('index')
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
        const getResponse = await fetch(`${server.url}/api/ping`)
        const jsonPingWithGet = await getResponse.json()
        t.expect(jsonPingWithGet.body).toStrictEqual({})
        t.expect(jsonPingWithGet.method).toEqual('GET')
        t.expect(jsonPingWithGet.url).toEqual('/ping')

        const postResponse = await fetch(`${server.url}/api/ping`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'param=value',
          follow: 0,
        }).then((res) => res.json())
        t.expect(postResponse.body).toStrictEqual({ param: 'value' })
        t.expect(postResponse.method).toEqual('POST')
        t.expect(postResponse.url).toEqual('/ping')
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
              {
                from: '/sign/*',
                to: `http://localhost:${port}/:splat`,
                signed: 'VAR_WITH_SIGNING_SECRET',
                status: 200,
              },
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
            const [getResponse, postResponse] = await Promise.all([
              fetch(`${server.url}/sign/ping`).then((res) => res.json()),
              fetch(`${server.url}/sign/ping`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'param=value',
                follow: 0,
              }).then((res) => res.json()),
            ])

            ;[(getResponse, postResponse)].forEach((response) => {
              const signature = response.headers['x-nf-sign']
              const payload = jwt.verify(signature, mockSigningSecret)

              t.expect(payload.deploy_context).toEqual('dev')
              t.expect(payload.netlify_id).toEqual(siteInfo.id)
              t.expect(payload.site_url).toEqual(siteInfo.url)
              t.expect(payload.iss).toEqual('netlify')
            })

            t.expect(postResponse.body).toStrictEqual({ param: 'value' })
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
        const [response1, response2] = await Promise.all([
          fetch(`${server.url}/api/ping`, { follow: 0, redirect: 'manual' }),
          fetch(`${server.url}/api/ping`).then((res) => res.json()),
        ])
        t.expect(response1.headers.get('location')).toEqual(`http://localhost:${port}/ping`)

        t.expect(response2.body).toStrictEqual({})
        t.expect(response2.method).toEqual('GET')
        t.expect(response2.url).toEqual('/ping')
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
        const response = await fetch(`${server.url}/api/echo`, {
          method: 'POST',
          body: 'param=value',
          follow: 0,
        })

        // Method Not Allowed
        t.expect(response.status).toBe(405)
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
        const response = await fetch(`${server.url}/foo`)

        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('<html><h1>foo')
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
          await fetch(`${server.url}/files/file with spaces`),
          await fetch(`${server.url}/files/[file_with_brackets]`),
        ])

        t.expect(await spaces.text()).toEqual('<html>file with spaces</html>')
        t.expect(await brackets.text()).toEqual('<html>file with brackets</html>')
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

        t.expect(etag).toBeTruthy()
        t.expect(res1.status).toBe(200)
        t.expect(await res1.text()).toBeTruthy()

        const res2 = await fetch(`${server.url}`, {
          headers: {
            'if-none-match': etag,
          },
        })

        t.expect(res2.status).toBe(304)
        t.expect(await res2.text()).toBeFalsy()

        const res3 = await fetch(`${server.url}`, {
          headers: {
            'if-none-match': 'stale-etag',
          },
        })

        t.expect(res3.headers.get('etag')).toBeTruthy()
        t.expect(res3.status).toBe(200)
        t.expect(await res3.text()).toBeTruthy()
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

        t.expect(entries.includes('.netlify')).toBe(true)
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

        t.expect(entries.includes('.netlify')).toBe(true)
      })
    })
  })
})
