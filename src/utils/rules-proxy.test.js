const path = require('path')
const test = require('ava')
const redirectParser = require('netlify-redirect-parser')
const { getLanguage, parseFile, parseRules } = require('./rules-proxy.js')
const { withSiteBuilder } = require('../../tests/utils/siteBuilder')
test('getLanguage', t => {
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

test('should parse redirect rules from netlify.toml', async t => {
  await withSiteBuilder('site-with-redirects-in-netlify-toml', async builder => {
    builder.withNetlifyToml({
      config,
    })

    await builder.buildAsync()

    const rules = await parseFile(redirectParser.parseNetlifyConfig, path.join(builder.directory, 'netlify.toml'))
    const expected = [
      {
        path: '/api/*',
        to: '/.netlify/functions/:splat',
        status: 200,
      },
      {
        path: '/foo',
        to: '/not-foo',
        status: 200,
        force: false,
      },
      {
        path: '/foo.html',
        to: '/not-foo',
        status: 200,
      },
      {
        path: '/not-foo',
        to: '/foo',
        status: 200,
        force: true,
      },
      {
        path: '/test-404a',
        to: '/foo',
        status: 404,
      },
      {
        path: '/test-404b',
        to: '/foo',
        status: 404,
      },
      {
        path: '/test-404c',
        to: '/foo',
        status: 404,
        force: true,
      },
    ]

    t.deepEqual(rules, expected)
  })
})

test('should parse redirect rules from _redirects file', async t => {
  await withSiteBuilder('site-with-redirects-file', async builder => {
    builder.withRedirectsFile({
      redirects,
    })

    await builder.buildAsync()

    const rules = await parseFile(redirectParser.parseRedirectsFormat, path.join(builder.directory, '_redirects'))
    const expected = [
      {
        path: '/something',
        to: '/ping',
        status: 200,
      },
    ]

    t.deepEqual(rules, expected)
  })
})

test('should parse redirect rules from _redirects file and netlify.toml', async t => {
  await withSiteBuilder('site-with-redirects-file-and-netlify-toml', async builder => {
    builder
      .withRedirectsFile({
        redirects,
      })
      .withNetlifyToml({
        config,
      })

    await builder.buildAsync()

    const files = [path.join(builder.directory, '_redirects'), path.join(builder.directory, 'netlify.toml')]
    const rules = await parseRules(files)
    const expected = [
      {
        path: '/something',
        to: '/ping',
        status: 200,
      },
      {
        path: '/api/*',
        to: '/.netlify/functions/:splat',
        status: 200,
      },
      {
        path: '/foo',
        to: '/not-foo',
        status: 200,
        force: false,
      },
      {
        path: '/foo.html',
        to: '/not-foo',
        status: 200,
      },
      {
        path: '/not-foo',
        to: '/foo',
        status: 200,
        force: true,
      },
      {
        path: '/test-404a',
        to: '/foo',
        status: 404,
      },
      {
        path: '/test-404b',
        to: '/foo',
        status: 404,
      },
      {
        path: '/test-404c',
        to: '/foo',
        status: 404,
        force: true,
      },
    ]

    t.deepEqual(rules, expected)
  })
})
