// Handlers are meant to be async outside tests
import fs from 'node:fs/promises'
import { type AddressInfo } from 'node:net'
import path from 'node:path'
import process from 'process'

import js from 'dedent'
import getPort from 'get-port'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import fetch from 'node-fetch'
import { describe, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { startExternalServer } from '../../utils/external-server.js'
import { withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder, type SiteBuilder } from '../../utils/site-builder.js'

type BlobFixture = {
  key: string
  content: string
  metadata?: Record<string, unknown> | null | undefined
}

const withServeBlobsFunction = (builder: SiteBuilder): SiteBuilder =>
  builder
    .withContentFile({
      path: 'netlify/functions/index.ts',
      content: `
      import { getDeployStore } from "@netlify/blobs";

      export default async (request: Request) => {
        const store = getDeployStore();
        const blob = await store.getWithMetadata(new URL(request.url).pathname.slice(1));
        return new Response(blob != null ? JSON.stringify(blob) : null, { status: blob == null ? 404 : 200 });
      };

      export const config = { path: "/*" };
      `,
    })
    .withContentFile({
      path: 'package.json',
      content: JSON.stringify({
        dependencies: {
          '@netlify/blobs': '^8.0.0',
        },
      }),
    })
    .withCommand({ command: ['npm', 'install'] })

const withBlobs = (builder: SiteBuilder, fixtures: BlobFixture[]): SiteBuilder => {
  for (const { content, key, metadata } of fixtures) {
    builder.withContentFile({
      content,
      path: path.join('.netlify/blobs/deploy', key),
    })

    if (metadata != null) {
      // Write a separate `<blob_path>/$<blob_name>.json` file
      const pathSegments = key.split(path.sep).slice(0, -1)
      const name = `$${key.split(path.sep).at(-1)!}.json`
      const metadataKey = path.join(...pathSegments, name)

      builder.withContentFile({
        content: JSON.stringify(metadata),
        path: path.join('.netlify/blobs/deploy', metadataKey),
      })
    }
  }
  return builder
}

describe.concurrent('command/dev', () => {
  test('should return 404.html if exists for non existing routes', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({
        path: '404.html',
        content: '<h1>404 - Page not found</h1>',
      })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/non-existent`)
        t.expect(response.headers.get('etag')).toBe(null)
        t.expect(await response.text()).toEqual('<h1>404 - Page not found</h1>')
      })
    })
  })

  test('should return 404.html from publish folder if exists for non existing routes', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/non-existent`)
        t.expect(response.status).toBe(404)
        t.expect(response.headers.get('etag')).toBe(null)
        t.expect(await response.text()).toEqual('<h1>404 - My Custom 404 Page</h1>')
      })
    })
  })

  test('should return 404 for redirect', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/test-404`)
        t.expect(response.headers.get('etag')).toBeTruthy()
        t.expect(response.status).toBe(404)
        t.expect(await response.text()).toEqual('<html><h1>foo')
      })
    })
  })

  test('should ignore 404 redirect for existing file', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/test-404`)

        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('<html><h1>This page actually exists')
      })
    })
  })

  test('should follow 404 redirect even with existing file when force=true', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/test-404`)

        t.expect(response.status).toBe(404)
        t.expect(await response.text()).toEqual('<html><h1>foo')
      })
    })
  })

  test('should source redirects file from publish directory', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/test`)

        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('index')
      })
    })
  })

  test('should rewrite requests to an external server', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const externalServer = startExternalServer()
      const { port } = externalServer.address() as AddressInfo
      builder.withRedirectsFile({
        redirects: [{ from: '/api/*', to: `http://localhost:${port.toString()}/:splat`, status: 200 }],
      })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const getResponse = await fetch(`${server.url}/api/ping`)
        const jsonPingWithGet = await getResponse.json()
        t.expect(jsonPingWithGet).toHaveProperty('method', 'GET')
        t.expect(jsonPingWithGet).toHaveProperty('url', '/ping')

        const postResponse = await fetch(`${server.url}/api/ping`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'param=value',
          follow: 0,
        })
        const postBody = await postResponse.json()
        t.expect(postBody).toHaveProperty('body', { param: 'value' })
        t.expect(postBody).toHaveProperty('method', 'POST')
        t.expect(postBody).toHaveProperty('url', '/ping')
      })

      externalServer.close()
    })
  })

  test('should sign external redirects with the `x-nf-sign` header when a `signed` value is set', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const mockSigningSecret = 'iamverysecret'
      const externalServer = startExternalServer()
      const { port } = externalServer.address() as AddressInfo
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
                to: `http://localhost:${port.toString()}/:splat`,
                signed: 'VAR_WITH_SIGNING_SECRET',
                status: 200,
              },
            ],
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
              NETLIFY_SITE_ID: siteInfo.id,
              NETLIFY_AUTH_TOKEN: 'fake-token',
            },
          },
          async (server) => {
            const [getResponse, postResponse] = await Promise.all([
              fetch(`${server.url}/sign/ping`),
              fetch(`${server.url}/sign/ping`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'param=value',
                follow: 0,
              }),
            ])
            const getBody = await getResponse.json()
            const postBody = await postResponse.json()

            ;[getBody, postBody].forEach((response) => {
              const signature = (response as { headers: Record<string, string> }).headers['x-nf-sign']
              const payload = jwt.verify(signature, mockSigningSecret) as JwtPayload

              t.expect(payload.deploy_context).toEqual('dev')
              t.expect(payload.netlify_id).toEqual(siteInfo.id)
              t.expect(payload.site_url).toEqual(siteInfo.url)
              t.expect(payload.iss).toEqual('netlify')
            })

            t.expect(postBody).toHaveProperty('body', { param: 'value' })
          },
        )
      })

      externalServer.close()
    })
  })

  test('follows 301 redirect to an external server', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const externalServer = startExternalServer()
      const { port } = externalServer.address() as AddressInfo
      builder.withRedirectsFile({
        redirects: [{ from: '/api/*', to: `http://localhost:${port.toString()}/:splat`, status: 301 }],
      })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const [response1, response2] = await Promise.all([
          fetch(`${server.url}/api/ping`, { follow: 0, redirect: 'manual' }),
          fetch(`${server.url}/api/ping`),
        ])
        const response2Body = await response2.json()
        t.expect(response1.headers.get('location')).toEqual(`http://localhost:${port.toString()}/ping`)

        t.expect(response2Body).toHaveProperty('method', 'GET')
        t.expect(response2Body).toHaveProperty('url', '/ping')
      })

      externalServer.close()
    })
  })

  test('should proxy server without waiting for port', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const externalServer = startExternalServer()
      await builder.build()

      await withDevServer({ cwd: builder.directory, skipWaitPort: true }, async (server) => {
        const response = await fetch(`${server.url}/api/test`)
        t.expect(response.status).toBe(404)
      })

      externalServer.close()
    })
  })

  test('should detect ipVer when proxying without waiting for port', async (t) => {
    // ipv6 is default from node 18
    const nodeVer = Number.parseInt(process.versions.node.split('.')[0])
    t.expect(nodeVer).toBeGreaterThanOrEqual(18)

    await withSiteBuilder(t, async (builder) => {
      const externalServer = startExternalServer({
        host: '127.0.0.1',
        port: 4567,
      })
      await builder.build()

      await withDevServer(
        { cwd: builder.directory, command: 'node', framework: '#custom', targetPort: 4567, skipWaitPort: true },
        async (server) => {
          const response = await fetch(`${server.url}/test`)
          t.expect(response.status).toBe(200)
          t.expect(String(server.output)).toContain('Switched host to 127.0.0.1')
        },
      )

      externalServer.close()
    })
  })

  test('should rewrite POST request if content-type is missing and not crash dev server', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({
        config: {
          functions: { directory: 'functions' },
          redirects: [{ from: '/api/*', to: '/other/:splat', status: 200 }],
        },
      })

      await builder.build()

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
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFile({
          path: 'foo.html',
          content: '<html><h1>foo',
        })
        .withContentFile({
          path: 'foo/file.html',
          content: '<html><h1>file in folder',
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/foo`)

        t.expect(response.status).toBe(200)
        t.expect(await response.text()).toEqual('<html><h1>foo')
      })
    })
  })

  test('should not shadow an existing file that has unsafe URL characters', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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

      await builder.build()

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
    await withSiteBuilder(t, async (builder) => {
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

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const res1 = await fetch(server.url)
        const etag = res1.headers.get('etag')

        t.expect(etag).toBeTruthy()
        t.expect(res1.status).toBe(200)
        t.expect(await res1.text()).toBeTruthy()

        const res2 = await fetch(server.url, {
          headers: {
            'if-none-match': etag!,
          },
        })

        t.expect(res2.status).toBe(304)
        t.expect(await res2.text()).toBeFalsy()

        const res3 = await fetch(server.url, {
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
    await withSiteBuilder(t, async (builder) => {
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
        .build()

      await withDevServer({ cwd: builder.directory }, async () => {
        const gitignore = await fs.readFile(path.join(builder.directory, '.gitignore'), 'utf8')
        const entries = gitignore.split('\n')

        t.expect(entries.includes('.netlify')).toBe(true)
      })
    })
  })

  test('should create a `.gitignore` file with `.netlify`', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'index.html',
          content: '<html><h1>Hi',
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async () => {
        const gitignore = await fs.readFile(path.join(builder.directory, '.gitignore'), 'utf8')
        const entries = gitignore.split('\n')

        t.expect(entries.includes('.netlify')).toBe(true)
      })
    })
  })

  test('should not add `.netlify` to `.gitignore` when --skip-gitignore flag is used', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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
        .build()

      await withDevServer({ cwd: builder.directory, args: ['--skip-gitignore'] }, async () => {
        const gitignore = await fs.readFile(path.join(builder.directory, '.gitignore'), 'utf8')
        const entries = gitignore.split('\n')

        t.expect(entries.includes('.netlify')).toBe(false)
        t.expect(entries).toEqual(existingGitIgnore)
      })
    })
  })

  test('should not create a `.gitignore` file when --skip-gitignore flag is used', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'index.html',
          content: '<html><h1>Hi',
        })
        .build()

      await withDevServer({ cwd: builder.directory, args: ['--skip-gitignore'] }, async () => {
        try {
          await fs.access(path.join(builder.directory, '.gitignore'))
          t.expect(false).toBe(true) // Should not reach here
        } catch (error) {
          // File should not exist, which is expected
          t.expect((error as NodeJS.ErrnoException).code).toBe('ENOENT')
        }
      })
    })
  })

  describe.concurrent('blobs', () => {
    describe.concurrent('on startup', () => {
      test.skipIf(process.env.NETLIFY_TEST_DISABLE_LIVE === 'true')(
        'seeds the blob server with files written to `.netlify/blobs/deploy` by the user',
        async (t) => {
          await withSiteBuilder(t, async (builder) => {
            const blobFixtures = [
              { key: 'test.txt', content: 'I am the first test blob', metadata: null },
              { key: 'test2.txt', content: 'I am the second test blob', metadata: null },
              { key: 'subdir/test3.txt', content: 'I am the third (nested) test blob', metadata: null },
              {
                key: 'subdir/deeper/test4.txt',
                content: 'I am the fourth (more deeply nested) test blob',
                metadata: null,
              },
            ]
            withBlobs(builder, blobFixtures)
            withServeBlobsFunction(builder)

            await builder.build()

            await withDevServer({ cwd: builder.directory }, async (server) => {
              t.expect.hasAssertions()
              t.expect.assertions(blobFixtures.length * 2)
              for (const { content, key } of blobFixtures) {
                const res = await fetch(new URL(`/${key}`, server.url))
                t.expect(res.status).toBe(200)

                const body = await res.json()
                t.expect(body).toHaveProperty('data', content)
              }
            })
          })
        },
      )

      test.skipIf(process.env.NETLIFY_TEST_DISABLE_LIVE === 'true')(
        'reads metadata files and attaches their contents to their corresponding blob',
        async (t) => {
          await withSiteBuilder(t, async (builder) => {
            const blobFixtures = [
              { key: 'test.txt', content: 'I am the first test blob', metadata: { type: 'my-junk' } },
            ]
            withBlobs(builder, blobFixtures)
            withServeBlobsFunction(builder)

            await builder.build()

            await withDevServer({ cwd: builder.directory }, async (server) => {
              t.expect.hasAssertions()
              t.expect.assertions(blobFixtures.length * 2)
              for (const { key, metadata } of blobFixtures) {
                const res = await fetch(new URL(`/${key}`, server.url))
                t.expect(res.status).toBe(200)

                const body = await res.json()
                t.expect(body).toHaveProperty('metadata', metadata)
              }
            })
          })
        },
      )

      test('does not write metadata files to the blob server', async (t) => {
        await withSiteBuilder(t, async (builder) => {
          builder.withContentFile({
            content: '{"type":"metadata_only"}',
            path: '.netlify/blobs/deploy/$test.txt.json',
          })

          await builder.build()

          await withDevServer({ cwd: builder.directory }, async (server) => {
            const res = await fetch(new URL('/$test.txt.json', server.url))
            t.expect(res.status).toBe(404)
          })
        })
      })

      test.skipIf(process.env.NETLIFY_TEST_DISABLE_LIVE === 'true')(
        'seeds the blob server with files written to `.netlify/blobs/deploy` by the onDev stage',
        async (t) => {
          t.expect.hasAssertions()

          await withSiteBuilder(t, async (builder) => {
            withServeBlobsFunction(builder)
            builder
              .withBuildPlugin({
                name: 'deploy-blobs',
                plugin: {
                  async onDev() {
                    const fs = require('node:fs/promises') as typeof import('node:fs/promises')

                    await fs.mkdir('.netlify/blobs/deploy', { recursive: true })
                    await fs.writeFile(`.netlify/blobs/deploy/test.txt`, 'I am the first test blob')
                  },
                },
              })
              .withNetlifyToml({
                config: {
                  plugins: [{ package: './plugins/deploy-blobs' }],
                },
              })

            await builder.build()

            await withDevServer({ cwd: builder.directory, debug: true }, async (server) => {
              const res = await fetch(new URL(`/test.txt`, server.url))
              t.expect(res.status).toBe(200)

              const body = await res.json()
              t.expect(body).toEqual({ data: 'I am the first test blob', metadata: {} })
            })
          })
        },
      )

      test('ensures installation of dev server plugins', async (t) => {
        await withSiteBuilder(t, async (builder) => {
          await builder
            .withNetlifyToml({
              config: {
                plugins: [{ package: '@netlify/plugin-1' }],
              },
            })
            .withPackageJson({
              packageJson: {
                dependencies: {
                  '@netlify/plugin-1': '^6.3.0',
                  '@netlify/plugin-2': '^6.3.0',
                },
              },
            })
            .withMockPackage({
              name: '@netlify/plugin-1',
              content: '',
            })
            .withMockPackage({
              name: '@netlify/plugin-2',
              content: '',
            })
            .build()

          await withDevServer(
            {
              cwd: builder.directory,
              env: {
                NETLIFY_INCLUDE_DEV_SERVER_PLUGIN: '@netlify/plugin-1,@netlify/plugin-2',
              },
            },
            async (server) => {
              const output = server.outputBuffer.map((buf: Buffer) => buf.toString()).join('\n')
              t.expect(output).toContain('Local dev server ready')
              // With node 23 we might be getting some warnings from one of our dependencies
              // which should go away once this is merged: https://github.com/debug-js/debug/pull/977
              const errorOutput = server.errorBuffer.map((buf: Buffer) => buf.toString()).join('\n')
              t.expect(errorOutput).not.toContain('Error')
            },
          )
        })
      })

      test('ensures dev server plugins can mutate env', async (t) => {
        await withSiteBuilder(t, async (builder) => {
          const port = await getPort()

          await builder
            .withNetlifyToml({
              config: {
                plugins: [{ package: './plugins/plugin' }],
                dev: {
                  command: 'node index.mjs',
                  targetPort: port,
                },
              },
            })
            .withBuildPlugin({
              name: 'plugin',
              plugin: {
                onPreDev({ netlifyConfig }) {
                  netlifyConfig.build.environment.SOME_ENV = 'value'
                },
              },
            })
            .withContentFile({
              path: 'index.mjs',
              content: `
              import process from 'process';
              import http from 'http';

              const server = http.createServer((req, res) => {
                res.write(process.env.SOME_ENV)
                res.end();
              })

              server.listen(${port.toString()})
              `,
            })
            .build()

          await withDevServer(
            {
              cwd: builder.directory,
            },
            async (server) => {
              const output = server.outputBuffer.map((buf: Buffer) => buf.toString()).join('\n')
              t.expect(output).toContain('Netlify configuration property "build.environment.SOME_ENV" value changed.')
              t.expect(output).toContain('Local dev server ready')

              const res = await fetch(new URL('/', server.url))
              t.expect(res.status).toBe(200)
              t.expect(await res.text()).toBe('value')
            },
          )
        })
      })
    })
  })

  test('should inject `branch-deploy` and `branch` context env vars when given context matches `branch:*`', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'netlify/functions/get-foo.mjs',
          content: js`
            export default async () => Response.json({
              WITH_BRANCH_OVERRIDE: process.env.WITH_BRANCH_OVERRIDE ?? "WITH_BRANCH_OVERRIDE not defined",
              WITHOUT_OVERRIDE: process.env.WITHOUT_OVERRIDE ?? "WITHOUT_OVERRIDE not defined",
            })`,
        })
        .build()

      const siteInfo = {
        id: 'site_id',
        name: 'site-name',
        account_slug: 'test-account',
        build_settings: { env: {} },
      }
      const routes = [
        { path: 'sites/site_id', response: siteInfo },
        { path: 'sites/site_id/service-instances', response: [] },
        {
          path: 'accounts',
          response: [{ slug: siteInfo.account_slug }],
        },
        {
          path: 'accounts/test-account/env',
          response: [
            {
              key: 'WITH_BRANCH_OVERRIDE',
              scopes: ['builds', 'functions', 'runtime'],
              values: [
                { context: 'branch-deploy' as const, value: 'value from branch-deploy context' },
                {
                  context: 'branch' as const,
                  context_parameter: 'feat/make-it-pop',
                  value: 'value from branch context',
                },
                { context: 'dev' as const, value: 'value from dev context' },
                { context: 'production' as const, value: 'value from production context' },
                {
                  context: 'deploy-preview' as const,
                  context_parameter: '12345',
                  value: 'value from deploy-preview context',
                },
                { context: 'all' as const, value: 'value from all context' },
              ],
            },
            {
              key: 'WITHOUT_OVERRIDE',
              scopes: ['builds', 'functions', 'runtime'],
              values: [
                { context: 'branch-deploy' as const, value: 'value from branch-deploy context' },
                { context: 'all' as const, value: 'value from all context' },
              ],
            },
          ],
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        await withDevServer(
          {
            cwd: builder.directory,
            offline: false,
            context: 'branch:feat/make-it-pop',
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_SITE_ID: siteInfo.id,
            },
          },
          async (server) => {
            const response = await fetch(`${server.url}/.netlify/functions/get-foo`)
            const data = (await response.json()) as { WITH_BRANCH_OVERRIDE: string; WITHOUT_OVERRIDE: string }

            t.expect(response).toHaveProperty('status', 200)
            t.expect(data).toHaveProperty('WITH_BRANCH_OVERRIDE', 'value from branch context')
            t.expect(data).toHaveProperty('WITHOUT_OVERRIDE', 'value from branch-deploy context')
          },
        )
      })
    })
  })
})
