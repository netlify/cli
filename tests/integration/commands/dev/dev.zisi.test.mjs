// Handlers are meant to be async outside tests
import { copyFile } from 'fs/promises'
import { Agent } from 'node:https'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

import nodeFetch from 'node-fetch'
import { describe, test } from 'vitest'

import { curl } from '../../utils/curl.mjs'
import { withDevServer } from '../../utils/dev-server.mjs'
import { withMockApi } from '../../utils/mock-api.mjs'
import { withSiteBuilder } from '../../utils/site-builder.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const testMatrix = [{ args: [] }]

describe('withSiteBuilder with args: $args', ({ args }) => {
  test('should handle query params in redirects', async (t) => {
    await withSiteBuilder('site-with-query-redirects', async (builder) => {
      await builder
        .withContentFile({
          path: 'public/index.html',
          content: 'home',
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
          },
        })
        .withRedirectsFile({
          redirects: [
            { from: '/api/*', to: '/.netlify/functions/echo?a=1&a=2', status: '200' },
            { from: '/foo', to: '/', status: '302' },
            { from: '/bar', to: '/?a=1&a=2', status: '302' },
            { from: '/test id=:id', to: '/?param=:id' },
            { from: '/baz/*', to: '/.netlify/functions/echo?query=:splat' },
          ],
        })
        .withFunction({
          path: 'echo.js',
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify(event),
          }),
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const [fromFunction, queryPassthrough, queryInRedirect, withParamMatching, functionWithSplat] =
          await Promise.all([
            nodeFetch(`${server.url}/api/test?foo=1&foo=2&bar=1&bar=2`).then((res) => res.json()),
            nodeFetch(`${server.url}/foo?foo=1&foo=2&bar=1&bar=2`, { redirect: 'manual' }),
            nodeFetch(`${server.url}/bar?foo=1&foo=2&bar=1&bar=2`, { redirect: 'manual' }),
            nodeFetch(`${server.url}/test?id=1`, { redirect: 'manual' }),
            nodeFetch(`${server.url}/baz/abc`).then((res) => res.json()),
          ])

        // query params should be taken from redirect rule for functions
        t.expect(fromFunction.multiValueQueryStringParameters).toStrictEqual({ bar: ['1', '2'], foo: ['1', '2'] })

        // query params should be passed through from the request
        t.expect(queryPassthrough.headers.get('location')).toEqual(`${server.url}/?foo=1&foo=2&bar=1&bar=2`)

        // query params should be taken from the redirect rule
        t.expect(queryInRedirect.headers.get('location')).toEqual(`${server.url}/?a=1&a=2`)

        // query params should be taken from the redirect rule
        t.expect(withParamMatching.headers.get('location')).toEqual(`${server.url}/?param=1`)

        // splat should be passed as query param in function redirects
        t.expect(functionWithSplat.queryStringParameters).toStrictEqual({ query: 'abc' })
      })
    })
  })

  test('Should not use the ZISI function bundler if not using esbuild', async (t) => {
    await withSiteBuilder('site-with-esm-function', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withContentFile({
        path: path.join('functions', 'esm-function', 'esm-function.js'),
        content: `
export async function handler(event, context) {
  return {
    statusCode: 200,
    body: 'esm',
  };
}
    `,
      })

      await builder.buildAsync()

      t.expect(() =>
        withDevServer({ cwd: builder.directory, args }, async (server) =>
          nodeFetch(`${server.url}/.netlify/functions/esm-function`).text(),
        ),
      ).rejects.toThrow()
    })
  })

  test('Should use the ZISI function bundler and serve ESM functions if using esbuild', async (t) => {
    await withSiteBuilder('site-with-esm-function', async (builder) => {
      builder
        .withNetlifyToml({ config: { functions: { directory: 'functions', node_bundler: 'esbuild' } } })
        .withContentFile({
          path: path.join('functions', 'esm-function', 'esm-function.js'),
          content: `
export async function handler(event, context) {
  return {
    statusCode: 200,
    body: 'esm',
  };
}
    `,
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await nodeFetch(`${server.url}/.netlify/functions/esm-function`).then((res) => res.text())
        t.expect(response).toEqual('esm')
      })
    })
  })

  test('Should use the ZISI function bundler and serve TypeScript functions if using esbuild', async (t) => {
    await withSiteBuilder('site-with-ts-function', async (builder) => {
      builder
        .withNetlifyToml({ config: { functions: { directory: 'functions', node_bundler: 'esbuild' } } })
        .withContentFile({
          path: path.join('functions', 'ts-function', 'ts-function.ts'),
          content: `
type CustomResponse = string;

export const handler = async function () {
  const response: CustomResponse = "ts";

  return {
    statusCode: 200,
    body: response,
  };
};

    `,
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await nodeFetch(`${server.url}/.netlify/functions/ts-function`).then((res) => res.text())
        t.expect(response).toEqual('ts')
      })
    })
  })

  test('Should use the ZISI function bundler and serve TypeScript functions if not using esbuild', async (t) => {
    await withSiteBuilder('site-with-ts-function', async (builder) => {
      builder.withNetlifyToml({ config: { functions: { directory: 'functions' } } }).withContentFile({
        path: path.join('functions', 'ts-function', 'ts-function.ts'),
        content: `
type CustomResponse = string;

export const handler = async function () {
  const response: CustomResponse = "ts";

  return {
    statusCode: 200,
    body: response,
  };
};

    `,
      })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await nodeFetch(`${server.url}/.netlify/functions/ts-function`).then((res) => res.text())
        t.expect(response).toEqual('ts')
      })
    })
  })

  test(`should start https server when https dev block is configured`, async (t) => {
    await withSiteBuilder('sites-with-https-certificate', async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            dev: { https: { certFile: 'localhost.crt', keyFile: 'localhost.key' } },
            edge_functions: [
              {
                function: 'hello',
                path: '/',
              },
            ],
          },
        })
        .withContentFile({
          path: 'public/index.html',
          content: 'index',
        })
        .withContentFile({
          path: 'public/origin.html',
          content: 'origin',
        })
        .withRedirectsFile({
          redirects: [{ from: `/api/*`, to: `/.netlify/functions/:splat`, status: '200' }],
        })
        .withFunction({
          path: 'hello.js',
          handler: async (event) => ({
            statusCode: 200,
            body: JSON.stringify({ rawUrl: event.rawUrl }),
          }),
        })
        .withEdgeFunction({
          handler: async (req, { next }) => {
            if (req.url.includes('?ef=true')) {
              // eslint-disable-next-line n/callback-return
              const res = await next()
              const text = await res.text()

              return new Response(text.toUpperCase(), res)
            }

            if (req.url.includes('?ef=fetch')) {
              const url = new URL('/origin', req.url)

              return await fetch(url)
            }

            if (req.url.includes('?ef=url')) {
              return new Response(req.url)
            }
          },
          name: 'hello',
        })
        .buildAsync()

      await Promise.all([
        copyFile(`${__dirname}/../../../../localhost.crt`, `${builder.directory}/localhost.crt`),
        copyFile(`${__dirname}/../../../../localhost.key`, `${builder.directory}/localhost.key`),
      ])
      await withDevServer({ cwd: builder.directory, args }, async ({ port }) => {
        const options = {
          agent: new Agent({ rejectUnauthorized: false }),
        }

        t.expect(await nodeFetch(`https://localhost:${port}`, options).then((res) => res.text())).toEqual('index')
        t.expect(await nodeFetch(`https://localhost:${port}?ef=true`, options).then((res) => res.text())).toEqual(
          'INDEX',
        )
        t.expect(await nodeFetch(`https://localhost:${port}?ef=fetch`, options).then((res) => res.text())).toEqual(
          'origin',
        )
        t.expect(
          await nodeFetch(`https://localhost:${port}/api/hello`, options).then((res) => res.json()),
        ).toStrictEqual({
          rawUrl: `https://localhost:${port}/api/hello`,
        })

        // the fetch will go against the `https://` url of the dev server, which isn't trusted system-wide.
        // this is the expected behaviour for fetch, so we shouldn't change anything about it.
        t.expect(await nodeFetch(`https://localhost:${port}?ef=fetch`, options).then((res) => res.text())).toEqual(
          'origin',
        )
      })
    })
  })

  test(`should use custom functions timeouts`, async (t) => {
    await withSiteBuilder('site-with-custom-functions-timeout', async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'hello.js',
          handler: async () => {
            await new Promise((resolve) => {
              const SLEEP_TIME = 2000
              setTimeout(resolve, SLEEP_TIME)
            })
            return {
              statusCode: 200,
              body: 'Hello World',
            }
          },
        })
        .buildAsync()

      const siteInfo = {
        account_slug: 'test-account',
        id: 'site_id',
        name: 'site-name',
        functions_config: { timeout: 1 },
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
          async ({ url }) => {
            const error = await nodeFetch(`${url}/.netlify/functions/hello`).then((res) => res.text())
            t.expect(error.includes('TimeoutError: Task timed out after 1.00 seconds')).toBe(true)
          },
        )
      })
    })
  })

  // we need curl to reproduce this issue
  test.skipIf(os.platform() === 'win32')(`don't hang on 'Expect: 100-continue' header`, async () => {
    await withSiteBuilder('site-with-expect-header', async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'hello.js',
          handler: async () => ({ statusCode: 200, body: 'Hello' }),
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        await curl(`${server.url}/.netlify/functions/hello`, [
          '-i',
          '-v',
          '-d',
          '{"somefield":"somevalue"}',
          '-H',
          'Content-Type: application/json',
          '-H',
          `Expect: 100-continue' header`,
        ])
      })
    })
  })

  test(`serves non ascii static files correctly`, async (t) => {
    await withSiteBuilder('site-with-non-ascii-files', async (builder) => {
      await builder
        .withContentFile({
          path: 'public/范.txt',
          content: 'success',
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            redirects: [{ from: '/*', to: '/index.html', status: 200 }],
          },
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await nodeFetch(`${server.url}/${encodeURIComponent('范.txt')}`)
        t.expect(await response.text()).toEqual('success')
      })
    })
  })

  test(`returns headers set by function`, async (t) => {
    await withSiteBuilder('site-with-function-with-custom-headers', async (builder) => {
      await builder
        .withFunction({
          pathPrefix: 'netlify/functions',
          path: 'custom-headers.js',
          handler: async () => ({
            statusCode: 200,
            body: '',
            headers: { 'single-value-header': 'custom-value' },
            multiValueHeaders: { 'multi-value-header': ['custom-value1', 'custom-value2'] },
            metadata: { builder_function: true },
          }),
        })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const response = await nodeFetch(`${server.url}/.netlify/functions/custom-headers`)
        t.expect(response.headers.get('etag')).toBeFalsy()
        t.expect(response.headers.get('single-value-header')).toEqual('custom-value')
        t.expect(response.headers.get('multi-value-header')).toEqual('custom-value1, custom-value2')

        const builderResponse = await nodeFetch(`${server.url}/.netlify/builders/custom-headers`)
        t.expect(builderResponse.headers.get('etag')).toBeFalsy()
        t.expect(builderResponse.headers.get('single-value-header')).toEqual('custom-value')
        t.expect(builderResponse.headers.get('multi-value-header')).toEqual('custom-value1, custom-value2')
      })
    })
  })

  test('should match redirect when path is URL encoded', async (t) => {
    await withSiteBuilder('site-with-encoded-redirect', async (builder) => {
      await builder
        .withContentFile({ path: 'static/special[test].txt', content: `special` })
        .withRedirectsFile({ redirects: [{ from: '/_next/static/*', to: '/static/:splat', status: 200 }] })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const [response1, response2] = await Promise.all([
          nodeFetch(`${server.url}/_next/static/special[test].txt`).then((res) => res.text()),
          nodeFetch(`${server.url}/_next/static/special%5Btest%5D.txt`).then((res) => res.text()),
        ])
        t.expect(response1).toEqual('special')
        t.expect(response2).toEqual('special')
      })
    })
  })

  test(`should not redirect POST request to functions server when it doesn't exists`, async (t) => {
    await withSiteBuilder('site-with-post-request', async (builder) => {
      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        // an error is expected since we're sending a POST request to a static server
        // the important thing is that it's not proxied to the functions server
        const error = await nodeFetch(`${server.url}/api/test`, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: 'some=thing',
        })

        t.expect(error.status).toBe(405)
        t.expect(await error.text()).toEqual('Method Not Allowed')
      })
    })
  })
})
