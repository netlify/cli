const test = require('ava')

const { parseRedirects } = require('../../../src/utils/redirects.cjs')
const { withSiteBuilder } = require('../../integration/utils/site-builder.cjs')

const defaultConfig = {
  redirects: [
    {
      from: '/api/*',
      status: 200,
      to: '/.netlify/functions/:splat',
    },
    {
      force: false,
      from: '/foo',
      status: 200,
      to: '/not-foo',
    },
    {
      from: '/foo.html',
      status: 200,
      to: '/not-foo',
    },
    {
      force: true,
      from: '/not-foo',
      status: 200,
      to: '/foo',
    },
    {
      from: '/test-404a',
      status: 404,
      to: '/foo',
    },
    {
      from: '/test-404b',
      status: 404,
      to: '/foo',
    },
    {
      force: true,
      from: '/test-404c',
      status: 404,
      to: '/foo',
    },
  ],
}

const defaultRedirects = [{ from: '/something ', to: '/ping', status: 200 }]

const BASE_REDIRECT = {
  conditions: {},
  force: false,
  headers: {},
  proxy: false,
  params: {},
}

test('should parse redirect rules from netlify.toml', async (t) => {
  await withSiteBuilder('site-with-redirects-in-netlify-toml', async (builder) => {
    await builder
      .withNetlifyToml({
        config: defaultConfig,
      })
      .buildAsync()

    const redirects = await parseRedirects({ configPath: `${builder.directory}/netlify.toml` })
    const expected = [
      {
        ...BASE_REDIRECT,
        origin: '/api/*',
        path: '/api/*',
        to: '/.netlify/functions/:splat',
        status: 200,
      },
      {
        ...BASE_REDIRECT,
        origin: '/foo',
        path: '/foo',
        to: '/not-foo',
        status: 200,
        force: false,
      },
      {
        ...BASE_REDIRECT,
        origin: '/foo.html',
        path: '/foo.html',
        to: '/not-foo',
        status: 200,
      },
      {
        ...BASE_REDIRECT,
        origin: '/not-foo',
        path: '/not-foo',
        to: '/foo',
        status: 200,
        force: true,
      },
      {
        ...BASE_REDIRECT,
        origin: '/test-404a',
        path: '/test-404a',
        to: '/foo',
        status: 404,
      },
      {
        ...BASE_REDIRECT,
        origin: '/test-404b',
        path: '/test-404b',
        to: '/foo',
        status: 404,
      },
      {
        ...BASE_REDIRECT,
        origin: '/test-404c',
        path: '/test-404c',
        to: '/foo',
        status: 404,
        force: true,
      },
    ]

    t.deepEqual(redirects, expected)
  })
})

test('should parse redirect rules from _redirects file', async (t) => {
  await withSiteBuilder('site-with-redirects-file', async (builder) => {
    await builder
      .withRedirectsFile({
        redirects: defaultRedirects,
      })
      .buildAsync()

    const redirects = await parseRedirects({ redirectsFiles: [`${builder.directory}/_redirects`] })
    const expected = [
      {
        ...BASE_REDIRECT,
        origin: '/something',
        path: '/something',
        to: '/ping',
        status: 200,
      },
    ]

    t.deepEqual(redirects, expected)
  })
})

test('should parse redirect rules from _redirects file and netlify.toml', async (t) => {
  await withSiteBuilder('site-with-redirects-file-and-netlify-toml', async (builder) => {
    await builder
      .withRedirectsFile({
        redirects: defaultRedirects,
      })
      .withNetlifyToml({
        config: defaultConfig,
      })
      .buildAsync()

    const redirects = await parseRedirects({
      redirectsFiles: [`${builder.directory}/_redirects`],
      configPath: `${builder.directory}/netlify.toml`,
    })
    const expected = [
      {
        ...BASE_REDIRECT,
        origin: '/something',
        path: '/something',
        to: '/ping',
        status: 200,
      },
      {
        ...BASE_REDIRECT,
        origin: '/api/*',
        path: '/api/*',
        to: '/.netlify/functions/:splat',
        status: 200,
      },
      {
        ...BASE_REDIRECT,
        origin: '/foo',
        path: '/foo',
        to: '/not-foo',
        status: 200,
        force: false,
      },
      {
        ...BASE_REDIRECT,
        origin: '/foo.html',
        path: '/foo.html',
        to: '/not-foo',
        status: 200,
      },
      {
        ...BASE_REDIRECT,
        origin: '/not-foo',
        path: '/not-foo',
        to: '/foo',
        status: 200,
        force: true,
      },
      {
        ...BASE_REDIRECT,
        origin: '/test-404a',
        path: '/test-404a',
        to: '/foo',
        status: 404,
      },
      {
        ...BASE_REDIRECT,
        origin: '/test-404b',
        path: '/test-404b',
        to: '/foo',
        status: 404,
      },
      {
        ...BASE_REDIRECT,
        origin: '/test-404c',
        path: '/test-404c',
        to: '/foo',
        status: 404,
        force: true,
      },
    ]

    t.deepEqual(redirects, expected)
  })
})
