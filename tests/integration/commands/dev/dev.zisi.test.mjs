// Handlers are meant to be async outside tests
import { copyFile } from 'fs/promises'
import os from 'os'
import path from 'path'

// eslint-disable-next-line ava/use-test
import avaTest from 'ava'
import { isCI } from 'ci-info'
import { Response } from 'node-fetch'

import { curl } from '../../utils/curl.cjs'
import { withDevServer } from '../../utils/dev-server.cjs'
import got from '../../utils/got.cjs'
import { withMockApi } from '../../utils/mock-api.cjs'
import { withSiteBuilder } from '../../utils/site-builder.cjs'
import { fileURLToPath } from 'url'

const test = isCI ? avaTest.serial.bind(avaTest) : avaTest

// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const testMatrix = [{ args: [] }]

const testName = (title, args) => (args.length <= 0 ? title : `${title} - ${args.join(' ')}`)

testMatrix.forEach(({ args }) => {
  test(testName('should handle query params in redirects', args), async (t) => {
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
            got(`${server.url}/api/test?foo=1&foo=2&bar=1&bar=2`).json(),
            got(`${server.url}/foo?foo=1&foo=2&bar=1&bar=2`, { followRedirect: false }),
            got(`${server.url}/bar?foo=1&foo=2&bar=1&bar=2`, { followRedirect: false }),
            got(`${server.url}/test?id=1`, { followRedirect: false }),
            got(`${server.url}/baz/abc`).json(),
          ])

        // query params should be taken from redirect rule for functions
        t.deepEqual(fromFunction.multiValueQueryStringParameters, { bar: ['1', '2'], foo: ['1', '2'] })

        // query params should be passed through from the request
        t.is(queryPassthrough.headers.location, '/?foo=1&foo=2&bar=1&bar=2')

        // query params should be taken from the redirect rule
        t.is(queryInRedirect.headers.location, '/?a=1&a=2')

        // query params should be taken from the redirect rule
        t.is(withParamMatching.headers.location, '/?param=1')

        // splat should be passed as query param in function redirects
        t.deepEqual(functionWithSplat.queryStringParameters, { query: 'abc' })
      })
    })
  })

  test(testName('Should not use the ZISI function bundler if not using esbuild', args), async (t) => {
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

      await t.throwsAsync(() =>
        withDevServer({ cwd: builder.directory, args }, async (server) =>
          got(`${server.url}/.netlify/functions/esm-function`).text(),
        ),
      )
    })
  })

  test(testName('Should use the ZISI function bundler and serve ESM functions if using esbuild', args), async (t) => {
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
        const response = await got(`${server.url}/.netlify/functions/esm-function`).text()
        t.is(response, 'esm')
      })
    })
  })

  test(
    testName('Should use the ZISI function bundler and serve TypeScript functions if using esbuild', args),
    async (t) => {
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
          const response = await got(`${server.url}/.netlify/functions/ts-function`).text()
          t.is(response, 'ts')
        })
      })
    },
  )

  test(
    testName('Should use the ZISI function bundler and serve TypeScript functions if not using esbuild', args),
    async (t) => {
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
          const response = await got(`${server.url}/.netlify/functions/ts-function`).text()
          t.is(response, 'ts')
        })
      })
    },
  )

  test(testName(`should start https server when https dev block is configured`, args), async (t) => {
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
        const options = { https: { rejectUnauthorized: false }, throwHttpErrors: false }
        t.is(await got(`https://localhost:${port}/?ef=url`, options).text(), `https://localhost:${port}/?ef=url`)
        t.is(await got(`https://localhost:${port}`, options).text(), 'index')
        t.is(await got(`https://localhost:${port}?ef=true`, options).text(), 'INDEX')
        t.deepEqual(await got(`https://localhost:${port}/api/hello`, options).json(), {
          rawUrl: `https://localhost:${port}/api/hello`,
        })
        t.is(await got(`https://localhost:${port}?ef=fetch`, options).text(), 'origin')
      })
    })
  })

  test(testName(`should use custom functions timeouts`, args), async (t) => {
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
            const error = await t.throwsAsync(() => got(`${url}/.netlify/functions/hello`))
            t.true(error.response.body.includes('TimeoutError: Task timed out after 1.00 seconds'))
          },
        )
      })
    })
  })

  // we need curl to reproduce this issue
  if (os.platform() !== 'win32') {
    test(testName(`don't hang on 'Expect: 100-continue' header`, args), async () => {
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
  }

  test(testName(`serves non ascii static files correctly`, args), async (t) => {
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
        const response = await got(`${server.url}/${encodeURIComponent('范.txt')}`)
        t.is(response.body, 'success')
      })
    })
  })

  test(testName(`returns headers set by function`, args), async (t) => {
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
        const response = await got(`${server.url}/.netlify/functions/custom-headers`)
        t.falsy(response.headers.etag)
        t.is(response.headers['single-value-header'], 'custom-value')
        t.is(response.headers['multi-value-header'], 'custom-value1, custom-value2')
        const builderResponse = await got(`${server.url}/.netlify/builders/custom-headers`)
        t.falsy(builderResponse.headers.etag)
        t.is(builderResponse.headers['single-value-header'], 'custom-value')
        t.is(builderResponse.headers['multi-value-header'], 'custom-value1, custom-value2')
      })
    })
  })

  test(testName('should match redirect when path is URL encoded', args), async (t) => {
    await withSiteBuilder('site-with-encoded-redirect', async (builder) => {
      await builder
        .withContentFile({ path: 'static/special[test].txt', content: `special` })
        .withRedirectsFile({ redirects: [{ from: '/_next/static/*', to: '/static/:splat', status: 200 }] })
        .buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        const [response1, response2] = await Promise.all([
          got(`${server.url}/_next/static/special[test].txt`).text(),
          got(`${server.url}/_next/static/special%5Btest%5D.txt`).text(),
        ])
        t.is(response1, 'special')
        t.is(response2, 'special')
      })
    })
  })

  test(testName(`should not redirect POST request to functions server when it doesn't exists`, args), async (t) => {
    await withSiteBuilder('site-with-post-request', async (builder) => {
      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory, args }, async (server) => {
        // an error is expected since we're sending a POST request to a static server
        // the important thing is that it's not proxied to the functions server
        const error = await t.throwsAsync(() =>
          got.post(`${server.url}/api/test`, {
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: 'some=thing',
          }),
        )

        t.is(error.message, 'Response code 405 (Method Not Allowed)')
      })
    })
  })
})
