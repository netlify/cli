const test = require('ava')

const { withSiteBuilder } = require('../../tests/utils/site-builder')

const { getLanguage, parseRedirectRules } = require('./rules-proxy')

test('getLanguage', (t) => {
  const language = getLanguage({ 'accept-language': 'ur' })

  t.is(language, 'ur')
})

const config = {
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

const redirects = [{ from: '/something ', to: '/ping', status: 200 }]

const BASE_RULE = {
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
        config,
      })
      .buildAsync()

    const rules = await parseRedirectRules({ configPath: `${builder.directory}/netlify.toml` })
    const expected = [
      {
        ...BASE_RULE,
        origin: '/api/*',
        path: '/api/*',
        to: '/.netlify/functions/:splat',
        status: 200,
      },
      {
        ...BASE_RULE,
        origin: '/foo',
        path: '/foo',
        to: '/not-foo',
        status: 200,
        force: false,
      },
      {
        ...BASE_RULE,
        origin: '/foo.html',
        path: '/foo.html',
        to: '/not-foo',
        status: 200,
      },
      {
        ...BASE_RULE,
        origin: '/not-foo',
        path: '/not-foo',
        to: '/foo',
        status: 200,
        force: true,
      },
      {
        ...BASE_RULE,
        origin: '/test-404a',
        path: '/test-404a',
        to: '/foo',
        status: 404,
      },
      {
        ...BASE_RULE,
        origin: '/test-404b',
        path: '/test-404b',
        to: '/foo',
        status: 404,
      },
      {
        ...BASE_RULE,
        origin: '/test-404c',
        path: '/test-404c',
        to: '/foo',
        status: 404,
        force: true,
      },
    ]

    t.deepEqual(rules, expected)
  })
})

test('should parse redirect rules from _redirects file', async (t) => {
  await withSiteBuilder('site-with-redirects-file', async (builder) => {
    await builder
      .withRedirectsFile({
        redirects,
      })
      .buildAsync()

    const rules = await parseRedirectRules({ redirectsFiles: [`${builder.directory}/_redirects`] })
    const expected = [
      {
        ...BASE_RULE,
        origin: '/something',
        path: '/something',
        to: '/ping',
        status: 200,
      },
    ]

    t.deepEqual(rules, expected)
  })
})

test('should parse redirect rules from _redirects file and netlify.toml', async (t) => {
  await withSiteBuilder('site-with-redirects-file-and-netlify-toml', async (builder) => {
    await builder
      .withRedirectsFile({
        redirects,
      })
      .withNetlifyToml({
        config,
      })
      .buildAsync()

    const rules = await parseRedirectRules({
      redirectsFiles: [`${builder.directory}/_redirects`],
      configPath: `${builder.directory}/netlify.toml`,
    })
    const expected = [
      {
        ...BASE_RULE,
        origin: '/something',
        path: '/something',
        to: '/ping',
        status: 200,
      },
      {
        ...BASE_RULE,
        origin: '/api/*',
        path: '/api/*',
        to: '/.netlify/functions/:splat',
        status: 200,
      },
      {
        ...BASE_RULE,
        origin: '/foo',
        path: '/foo',
        to: '/not-foo',
        status: 200,
        force: false,
      },
      {
        ...BASE_RULE,
        origin: '/foo.html',
        path: '/foo.html',
        to: '/not-foo',
        status: 200,
      },
      {
        ...BASE_RULE,
        origin: '/not-foo',
        path: '/not-foo',
        to: '/foo',
        status: 200,
        force: true,
      },
      {
        ...BASE_RULE,
        origin: '/test-404a',
        path: '/test-404a',
        to: '/foo',
        status: 404,
      },
      {
        ...BASE_RULE,
        origin: '/test-404b',
        path: '/test-404b',
        to: '/foo',
        status: 404,
      },
      {
        ...BASE_RULE,
        origin: '/test-404c',
        path: '/test-404c',
        to: '/foo',
        status: 404,
        force: true,
      },
    ]

    t.deepEqual(rules, expected)
  })
})
