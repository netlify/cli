// Handlers are meant to be async outside tests
import fs from 'fs/promises'
import path from 'path'

import type { HandlerEvent } from '@netlify/functions'
import js from 'dedent'
import getPort from 'get-port'

import { describe, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { temporaryDirectory } from '../../../../src/utils/temporary-file.js'

describe.concurrent('commands/dev-forms-and-redirects', () => {
  test('should return 404 when redirecting to a non existing function', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withNetlifyToml({
        config: {
          functions: { directory: 'functions' },
          redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
        },
      })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/api/none`, {
          method: 'POST',
          body: 'nothing',
        })

        t.expect(response.status).toBe(404)
      })
    })
  })

  test('should parse function query parameters using simple parsing', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event: HandlerEvent) =>
            Promise.resolve({
              statusCode: 200,
              body: JSON.stringify(event),
            }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const [res1, res2] = await Promise.all([
          fetch(`${server.url}/.netlify/functions/echo?category[SOMETHING][]=something`),
          fetch(`${server.url}/.netlify/functions/echo?category=one&category=two`),
        ])

        t.expect(await res1.json()).toHaveProperty('queryStringParameters', { 'category[SOMETHING][]': 'something' })
        t.expect(await res2.json()).toHaveProperty('queryStringParameters', { category: 'one, two' })
      })
    })
  })

  test('should handle form submission', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFile({
          path: 'index.html',
          content: '<h1>⊂◉‿◉つ</h1>',
        })
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'submission-created.js',
          handler: async (event: HandlerEvent) =>
            Promise.resolve({
              statusCode: 200,
              body: JSON.stringify(event),
            }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const form = new FormData()
        form.append('some', 'thing')
        const response = await fetch(`${server.url}/?ding=dong`, {
          method: 'POST',
          body: form,
        }).then((res) => res.json())

        t.expect(response).toHaveProperty('body', t.expect.any(String))
        const body = JSON.parse((response as { body: string }).body) as unknown
        t.expect(body).toHaveProperty(
          'payload',
          t.expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            created_at: t.expect.any(String),
          }),
        )
        const expectedBody = {
          payload: {
            created_at: (body as { payload: { created_at: string } }).payload.created_at,
            data: {
              ip: '::ffff:127.0.0.1',
              some: 'thing',
              user_agent: 'node',
            },
            human_fields: {
              Some: 'thing',
            },
            ordered_human_fields: [
              {
                name: 'some',
                title: 'Some',
                value: 'thing',
              },
            ],
            site_url: '',
          },
        }

        t.expect(body).toStrictEqual(expectedBody)
        t.expect(response).toHaveProperty('headers.host', `${server.host}:${server.port.toString()}`)
        t.expect(response).toHaveProperty('headers.content-length', JSON.stringify(expectedBody).length.toString())
        t.expect(response).toHaveProperty('headers.content-type', 'application/json')
        t.expect(response).toHaveProperty('httpMethod', 'POST')
        t.expect(response).toHaveProperty('isBase64Encoded', false)
        t.expect(response).toHaveProperty('path', '/')
        t.expect(response).toHaveProperty('queryStringParameters', { ding: 'dong' })
      })
    })
  })

  test('should handle form submission with a background function', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'index.html',
          content: '<h1>⊂◉‿◉つ</h1>',
        })
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'submission-created-background.js',
          handler: async (event: HandlerEvent) =>
            Promise.resolve({
              statusCode: 200,
              body: JSON.stringify(event),
            }),
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const form = new FormData()
        form.append('some', 'thing')
        const response = await fetch(`${server.url}/?ding=dong`, {
          method: 'POST',
          body: form,
        })
        t.expect(response.status).toBe(202)
        t.expect(await response.text()).toEqual('')
      })
    })
  })

  test('should not handle form submission when content type is `text/plain`', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFile({
          path: 'index.html',
          content: '<h1>⊂◉‿◉つ</h1>',
        })
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'submission-created.js',
          handler: async (event: HandlerEvent) =>
            Promise.resolve({
              statusCode: 200,
              body: JSON.stringify(event),
            }),
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/?ding=dong`, {
          method: 'POST',
          body: 'Something',
          headers: {
            'content-type': 'text/plain',
          },
        })
        t.expect(response.status).toBe(405)
        t.expect(await response.text()).toEqual('Method Not Allowed')
      })
    })
  })

  test('should return existing local file even when rewrite matches when force=false', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFile({
          path: 'foo.html',
          content: '<html><h1>foo',
        })
        .withContentFile({
          path: path.join('not-foo', 'index.html'),
          content: '<html><h1>not-foo',
        })
        .withNetlifyToml({
          config: {
            redirects: [{ from: '/foo', to: '/not-foo', status: 200, force: false }],
          },
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/foo?ping=pong`).then((res) => res.text())
        t.expect(response).toEqual('<html><h1>foo')
      })
    })
  })

  test('should return existing local file even when redirect matches when force=false', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFile({
          path: 'foo.html',
          content: '<html><h1>foo',
        })
        .withContentFile({
          path: path.join('not-foo', 'index.html'),
          content: '<html><h1>not-foo',
        })
        .withNetlifyToml({
          config: {
            redirects: [{ from: '/foo', to: '/not-foo', status: 301, force: false }],
          },
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/foo?ping=pong`).then((res) => res.text())
        t.expect(response).toEqual('<html><h1>foo')
      })
    })
  })

  test('should ignore existing local file when redirect matches and force=true', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFile({
          path: 'foo.html',
          content: '<html><h1>foo',
        })
        .withContentFile({
          path: path.join('not-foo', 'index.html'),
          content: '<html><h1>not-foo',
        })
        .withNetlifyToml({
          config: {
            redirects: [{ from: '/foo', to: '/not-foo', status: 301, force: true }],
          },
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const [response, body] = await Promise.all([
          fetch(`${server.url}/foo`, { redirect: 'manual' }),
          fetch(`${server.url}/foo`).then((res) => res.text()),
        ])

        t.expect(response.headers.get('location')).toEqual('/not-foo')
        t.expect(body).toEqual('<html><h1>not-foo')
      })
    })
  })

  test('should use existing file when rule contains file extension and force=false', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFile({
          path: 'foo.html',
          content: '<html><h1>foo',
        })
        .withContentFile({
          path: path.join('not-foo', 'index.html'),
          content: '<html><h1>not-foo',
        })
        .withNetlifyToml({
          config: {
            redirects: [{ from: '/foo.html', to: '/not-foo', status: 301, force: false }],
          },
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/foo.html`, { redirect: 'manual' })
        t.expect(response).not.toHaveProperty('headers.location')
        t.expect(await response.text()).toEqual('<html><h1>foo')
      })
    })
  })

  test('should redirect when rule contains file extension and force=true', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFile({
          path: 'foo.html',
          content: '<html><h1>foo',
        })
        .withContentFile({
          path: path.join('not-foo', 'index.html'),
          content: '<html><h1>not-foo',
        })
        .withNetlifyToml({
          config: {
            redirects: [{ from: '/foo.html', to: '/not-foo', status: 301, force: true }],
          },
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const [response, body] = await Promise.all([
          fetch(`${server.url}/foo.html`, { redirect: 'manual' }),
          fetch(`${server.url}/foo.html`).then((res) => res.text()),
        ])

        t.expect(response.headers.get('location')).toEqual('/not-foo')
        t.expect(body).toEqual('<html><h1>not-foo')
      })
    })
  })

  test('should redirect from sub directory to root directory', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFile({
          path: 'foo.html',
          content: '<html><h1>foo',
        })
        .withContentFile({
          path: path.join('not-foo', 'index.html'),
          content: '<html><h1>not-foo',
        })
        .withNetlifyToml({
          config: {
            redirects: [{ from: '/not-foo', to: '/foo', status: 200, force: true }],
          },
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const [response1, response2, response3] = await Promise.all([
          fetch(`${server.url}/not-foo`).then((res) => res.text()),
          fetch(`${server.url}/not-foo/`).then((res) => res.text()),
          // TODO: check why this doesn't redirect
          fetch(`${server.url}/not-foo/index.html`).then((res) => res.text()),
        ])

        t.expect(response1).toEqual('<html><h1>foo')
        t.expect(response2).toEqual('<html><h1>foo')
        t.expect(response3).toEqual('<html><h1>not-foo')
      })
    })
  })

  test('Runs build plugins with the `onPreDev` event', async (t) => {
    const userServerPort = await getPort()
    const pluginManifest = 'name: local-plugin'

    // This test plugin starts an HTTP server that we'll hit when the dev server
    // is ready, asserting that plugins in dev mode can have long-running jobs.
    const pluginSource = js`
    const http = require("http");

    module.exports = {
      onPreBuild: () => {
        throw new Error("I should not run");
      },

      onPreDev: ({netlifyConfig}) => {
        netlifyConfig.headers.push({
          for: '/*',
          values: {
            'x-test': 'value'
          }
        });

        netlifyConfig.redirects.push({
          from: '/baz/*',
          to: 'http://localhost:${userServerPort.toString()}/:splat',
          status: 200,
          headers: {
            "X-NF-Hidden-Proxy": "true",
          },
        });

        const server = http.createServer((_, res) => res.end("Hello world"));

        server.listen(${userServerPort.toString()}, "localhost", () => {
          console.log("Server is running on port ${userServerPort.toString()}");
        });
      },
    };
  `

    const pluginDirectory = temporaryDirectory()

    await fs.writeFile(path.join(pluginDirectory, 'manifest.yml'), pluginManifest)
    await fs.writeFile(path.join(pluginDirectory, 'index.js'), pluginSource)

    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            plugins: [{ package: path.relative(builder.directory, pluginDirectory) }],
          },
        })
        .withContentFile({
          path: 'foo.html',
          content: '<html><h1>foo',
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const [response1, response2, response3] = await Promise.all([
          fetch(`${server.url}/foo`),
          fetch(`http://localhost:${userServerPort.toString()}`),
          fetch(`${server.url}/baz/path`),
        ])
        t.expect(await response1.text()).toEqual('<html><h1>foo')
        t.expect(response1.headers.get('x-test')).toEqual('value')
        t.expect(await response2.text()).toEqual('Hello world')
        t.expect(await response3.text()).toEqual('Hello world')

        t.expect(server.output).not.toContain(`Proxying to http://localhost:${userServerPort.toString()}/path`)
        t.expect(server.output).not.toContain(
          `[HPM] Proxy created: /  -> http://localhost:${userServerPort.toString()}`,
        )
      })
    })
  })

  test('Handles errors from the `onPreDev` event', async (t) => {
    const userServerPort = await getPort()
    const pluginManifest = 'name: local-plugin'

    // This test plugin starts an HTTP server that we'll hit when the dev server
    // is ready, asserting that plugins in dev mode can have long-running jobs.
    const pluginSource = `
    const http = require("http");

    module.exports = {
      onPreBuild: () => {
        throw new Error("I should not run");
      },

      onPreDev: () => {
        throw new Error("Something went wrong");
      },
    };
  `

    const pluginDirectory = temporaryDirectory()

    await fs.writeFile(path.join(pluginDirectory, 'manifest.yml'), pluginManifest)
    await fs.writeFile(path.join(pluginDirectory, 'index.js'), pluginSource)

    await withSiteBuilder(t, async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            plugins: [{ package: path.relative(builder.directory, pluginDirectory) }],
          },
        })
        .withContentFile({
          path: 'foo.html',
          content: '<html><h1>foo',
        })

      await builder.build()

      await t
        .expect(() =>
          withDevServer(
            { cwd: builder.directory },
            async (server) => {
              const [response1, response2] = await Promise.all([
                fetch(`${server.url}/foo`).then((res) => res.text()),
                fetch(`http://localhost:${userServerPort.toString()}`).then((res) => res.text()),
              ])
              t.expect(response1).toEqual('<html><h1>foo')
              t.expect(response2).toEqual('Hello world')
            },
            true,
          ),
        )
        .rejects.toThrowError()
    })
  })
})
