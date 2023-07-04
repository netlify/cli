// Handlers are meant to be async outside tests
import fs from 'fs/promises'
import path from 'path'

import FormData from 'form-data'
import getPort from 'get-port'
import { temporaryDirectory } from 'tempy'
import { describe, test } from 'vitest'

import { withDevServer } from './utils/dev-server.cjs'
import got from './utils/got.cjs'
import { withSiteBuilder } from './utils/site-builder.cjs'

// FIXME: Run tests serial
// const test = isCI ? avaTest.serial.bind(avaTest) : avaTest
describe.concurrent('500.command.dev', () => {
  test('should return 404 when redirecting to a non existing function', async (t) => {
    await withSiteBuilder('site-with-missing-function', async (builder) => {
      builder.withNetlifyToml({
        config: {
          functions: { directory: 'functions' },
          redirects: [{ from: '/api/*', to: '/.netlify/functions/:splat', status: 200 }],
        },
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got
          .post(`${server.url}/api/none`, {
            body: 'nothing',
          })
          .catch((error) => error.response)

        t.expect(response.statusCode).toBe(404)
      })
    })
  })

  test('should parse function query parameters using simple parsing', async (t) => {
    await withSiteBuilder('site-with-multi-part-function', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response1 = await got(`${server.url}/.netlify/functions/echo?category[SOMETHING][]=something`).json()
        const response2 = await got(`${server.url}/.netlify/functions/echo?category=one&category=two`).json()

        t.expect(response1.queryStringParameters).toStrictEqual({ 'category[SOMETHING][]': 'something' })
        t.expect(response2.queryStringParameters, { category: 'one).toStrictEqual(two' })
      })
    })
  })

  test('should handle form submission', async (t) => {
    await withSiteBuilder('site-with-form', async (builder) => {
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
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const form = new FormData()
        form.append('some', 'thing')
        const response = await got
          .post(`${server.url}/?ding=dong`, {
            body: form,
          })
          .json()

        const body = JSON.parse(response.body)
        const expectedBody = {
          payload: {
            created_at: body.payload.created_at,
            data: {
              ip: '::ffff:127.0.0.1',
              some: 'thing',
              user_agent: 'got (https://github.com/sindresorhus/got)',
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

        t.expect(response.headers.host).toEqual(`${server.host}:${server.port}`)
        t.expect(response.headers['content-length']).toEqual(JSON.stringify(expectedBody).length.toString())
        t.expect(response.headers['content-type']).toEqual('application/json')
        t.expect(response.httpMethod).toEqual('POST')
        t.expect(response.isBase64Encoded).toBe(false)
        t.expect(response.path).toEqual('/')
        t.expect(response.queryStringParameters).toStrictEqual({ ding: 'dong' })
        t.expect(body).toStrictEqual(expectedBody)
      })
    })
  })

  test('should handle form submission with a background function', async (t) => {
    await withSiteBuilder('site-with-form-background-function', async (builder) => {
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
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const form = new FormData()
        form.append('some', 'thing')
        const response = await got.post(`${server.url}/?ding=dong`, {
          body: form,
        })
        t.expect(response.statusCode).toBe(202)
        t.expect(response.body).toEqual('')
      })
    })
  })

  test('should not handle form submission when content type is `text/plain`', async (t) => {
    await withSiteBuilder('site-with-form-text-plain', async (builder) => {
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
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got
          .post(`${server.url}/?ding=dong`, {
            body: 'Something',
            headers: {
              'content-type': 'text/plain',
            },
          })
          .catch((error) => error.response)
        t.expect(response.statusCode).toBe(405)
        t.expect(response.body).toEqual('Method Not Allowed')
      })
    })
  })

  test('should return existing local file even when rewrite matches when force=false', async (t) => {
    await withSiteBuilder('site-with-shadowing-force-false', async (builder) => {
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

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got(`${server.url}/foo?ping=pong`).text()
        t.expect(response).toEqual('<html><h1>foo')
      })
    })
  })

  test('should return existing local file even when redirect matches when force=false', async (t) => {
    await withSiteBuilder('site-with-shadowing-force-false', async (builder) => {
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

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got(`${server.url}/foo?ping=pong`).text()
        t.expect(response).toEqual('<html><h1>foo')
      })
    })
  })

  test('should ignore existing local file when redirect matches and force=true', async (t) => {
    await withSiteBuilder('site-with-shadowing-force-true', async (builder) => {
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

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got(`${server.url}/foo`, { followRedirect: false })
        t.expect(response.headers.location).toEqual(`/not-foo`)

        const body = await got(`${server.url}/foo`).text()
        t.expect(body).toEqual('<html><h1>not-foo')
      })
    })
  })

  test('should use existing file when rule contains file extension and force=false', async (t) => {
    await withSiteBuilder('site-with-shadowing-file-extension-force-false', async (builder) => {
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

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got(`${server.url}/foo.html`, { followRedirect: false })
        t.expect(response.headers.location).toBeUndefined()
        t.expect(response.body).toEqual('<html><h1>foo')
      })
    })
  })

  test('should redirect when rule contains file extension and force=true', async (t) => {
    await withSiteBuilder('site-with-shadowing-file-extension-force-true', async (builder) => {
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

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await got(`${server.url}/foo.html`, { followRedirect: false })
        t.expect(response.headers.location).toEqual(`/not-foo`)

        const body = await got(`${server.url}/foo.html`).text()
        t.expect(body).toEqual('<html><h1>not-foo')
      })
    })
  })

  test('should redirect from sub directory to root directory', async (t) => {
    await withSiteBuilder('site-with-shadowing-sub-to-root', async (builder) => {
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

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response1 = await got(`${server.url}/not-foo`).text()
        const response2 = await got(`${server.url}/not-foo/`).text()

        // TODO: check why this doesn't redirect
        const response3 = await got(`${server.url}/not-foo/index.html`).text()

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
    const pluginSource = `
    const http = require("http");

    module.exports = {
      onPreBuild: () => {
        throw new Error("I should not run");
      },

      onPreDev: () => {
        const server = http.createServer((_, res) => res.end("Hello world"));

        server.listen(${userServerPort}, "localhost", () => {
          console.log("Server is running on port ${userServerPort}");
        });
      },
    };
  `

    const pluginDirectory = await temporaryDirectory()

    await fs.writeFile(path.join(pluginDirectory, 'manifest.yml'), pluginManifest)
    await fs.writeFile(path.join(pluginDirectory, 'index.js'), pluginSource)

    await withSiteBuilder('site-with-custom-server-in-plugin', async (builder) => {
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

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        await t.expect(await got(`${server.url}/foo`).text()).toEqual('<html><h1>foo')
        await t.expect(await got(`http://localhost:${userServerPort}`).text()).toEqual('Hello world')
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

    const pluginDirectory = await temporaryDirectory()

    await fs.writeFile(path.join(pluginDirectory, 'manifest.yml'), pluginManifest)
    await fs.writeFile(path.join(pluginDirectory, 'index.js'), pluginSource)

    await withSiteBuilder('site-with-custom-server-in-plugin', async (builder) => {
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

      await builder.buildAsync()

      await t
        .expect(() =>
          withDevServer(
            { cwd: builder.directory },
            async (server) => {
              // FIXME: Fix test case, expects does not evaluate
              t.expect(false).toBe(true)
              await t.expect(await got(`${server.url}/foo`).text()).toEqual('<html><h1>foo')
              await t.expect(await got(`http://localhost:${userServerPort}`).text()).toEqual('Hello world')
            },
            { message: /Error: Something went wrong/ },
          ),
        )
        .rejects.toThrowError()
    })
  })
})
