const path = require('path')

const test = require('ava')

const { createSiteBuilder } = require('../../tests/utils/site-builder')

const { parseHeaders, headersForPath, matchesPath } = require('./headers')

const headers = [
  { path: '/', headers: ['X-Frame-Options: SAMEORIGIN'] },
  { path: '/*', headers: ['X-Frame-Thing: SAMEORIGIN'] },
  {
    path: '/static-path/*',
    headers: [
      'X-Frame-Options: DENY',
      'X-XSS-Protection: 1; mode=block',
      'cache-control: max-age=0',
      'cache-control: no-cache',
      'cache-control: no-store',
      'cache-control: must-revalidate',
    ],
  },
  { path: '/:placeholder/index.html', headers: ['X-Frame-Options: SAMEORIGIN'] },
  /**
   * Do not force * to appear at end of path.
   *
   * @see https://github.com/netlify/next-on-netlify/issues/151
   * @see https://github.com/netlify/cli/issues/1148
   */
  {
    path: '/*/_next/static/chunks/*',
    headers: ['cache-control: public', 'cache-control: max-age=31536000', 'cache-control: immutable'],
  },
  {
    path: '/directory/*/test.html',
    headers: ['X-Frame-Options: test'],
  },
  {
    path: '/with-colon',
    headers: ['Custom-header: http://www.example.com'],
  },
]

test.before(async (t) => {
  const builder = createSiteBuilder({ siteName: 'site-for-detecting-server' })
  builder
    .withHeadersFile({
      headers,
    })
    .withContentFile({
      path: '_invalid_headers',
      content: `
/
  # This is valid
  X-Frame-Options: SAMEORIGIN
  # This is not valid
  X-Frame-Thing:
`,
    })

  await builder.buildAsync()

  t.context.builder = builder
})

test.after(async (t) => {
  await t.context.builder.cleanupAsync()
})

const parseHeadersFile = async function (t, fixtureName) {
  const normalizedHeadersFile = path.resolve(t.context.builder.directory, fixtureName)
  return await parseHeaders({ headersFiles: [normalizedHeadersFile] })
}

// Ignore added properties like `forRegExp`
const normalizeHeader = function ({ for: forPath, values }) {
  return { for: forPath, values }
}

/**
 * Pass if we can load the test headers without throwing an error.
 */
test('_headers: syntax validates as expected', async (t) => {
  await parseHeadersFile(t, '_headers')
})

test('_headers: throws on invalid syntax', async (t) => {
  await t.throwsAsync(parseHeadersFile(t, '_invalid_headers'), { message: /Missing header value/ })
})

test('_headers: validate rules', async (t) => {
  const rules = await parseHeadersFile(t, '_headers')
  const normalizedHeaders = rules.map(normalizeHeader)
  t.deepEqual(normalizedHeaders, [
    {
      for: '/',
      values: {
        'X-Frame-Options': 'SAMEORIGIN',
      },
    },
    {
      for: '/*',
      values: {
        'X-Frame-Thing': 'SAMEORIGIN',
      },
    },
    {
      for: '/static-path/*',
      values: {
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'cache-control': 'max-age=0, no-cache, no-store, must-revalidate',
      },
    },
    {
      for: '/:placeholder/index.html',
      values: {
        'X-Frame-Options': 'SAMEORIGIN',
      },
    },
    {
      for: '/*/_next/static/chunks/*',
      values: {
        'cache-control': 'public, max-age=31536000, immutable',
      },
    },
    {
      for: '/directory/*/test.html',
      values: {
        'X-Frame-Options': 'test',
      },
    },
    {
      for: '/with-colon',
      values: {
        'Custom-header': 'http://www.example.com',
      },
    },
  ])
})

test('_headers: headersForPath testing', async (t) => {
  const rules = await parseHeadersFile(t, '_headers')
  const normalizedHeaders = rules.map(normalizeHeader)
  t.deepEqual(headersForPath(normalizedHeaders, '/'), {
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Frame-Thing': 'SAMEORIGIN',
  })
  t.deepEqual(headersForPath(normalizedHeaders, '/placeholder'), {
    'X-Frame-Thing': 'SAMEORIGIN',
  })
  t.deepEqual(headersForPath(normalizedHeaders, '/static-path/placeholder'), {
    'X-Frame-Thing': 'SAMEORIGIN',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'cache-control': 'max-age=0, no-cache, no-store, must-revalidate',
  })
  t.deepEqual(headersForPath(normalizedHeaders, '/static-path'), {
    'X-Frame-Thing': 'SAMEORIGIN',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'cache-control': 'max-age=0, no-cache, no-store, must-revalidate',
  })
  t.deepEqual(headersForPath(normalizedHeaders, '/placeholder/index.html'), {
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Frame-Thing': 'SAMEORIGIN',
  })
  t.deepEqual(headersForPath(normalizedHeaders, '/placeholder/_next/static/chunks/placeholder'), {
    'X-Frame-Thing': 'SAMEORIGIN',
    'cache-control': 'public, max-age=31536000, immutable',
  })
  t.deepEqual(headersForPath(normalizedHeaders, '/directory/placeholder/test.html'), {
    'X-Frame-Thing': 'SAMEORIGIN',
    'X-Frame-Options': 'test',
  })
})

/**
 * The bulk of the _headers logic concerns testing whether or not a path matches
 * a rule - focus on testing `matchesPath` over `headersForPath` (the latter just
 * straightforwardly combines a bunch of objects).
 */
test('_headers: matchesPath matches rules as expected', (t) => {
  t.assert(matchesPath('/', '/'))
  t.assert(matchesPath('/*', '/'))

  /**
   * Make sure (:placeholder) will NOT match root dir.
   */
  t.assert(!matchesPath('/:placeholder', '/'))

  /**
   * Make sure (:placeholder) will NOT recursively match subdirs.
   */
  t.assert(!matchesPath('/path/to/:placeholder', '/path/two/dir/one/two/three'))

  /**
   * (:placeholder) wildcard tests.
   */
  t.assert(matchesPath('/directory/:placeholder', '/directory/test'))
  t.assert(matchesPath('/directory/:placeholder/test', '/directory/placeholder/test'))
  t.assert(!matchesPath('/directory/:placeholder', '/directory/test/test'))
  t.assert(!matchesPath('/path/to/dir/:placeholder', '/path/to/dir'))
  t.assert(matchesPath('/path/to/dir/:placeholder', '/path/to/dir/placeholder'))

  /**
   * (*) wildcard tests.
   */
  t.assert(matchesPath('/path/*/dir', '/path/to/dir'))
  t.assert(matchesPath('/path/to/*/*/*', '/path/to/one/two/three'))
  t.assert(matchesPath('/path/*/to/*/dir', '/path/placeholder/to/placeholder/dir'))
  t.assert(!matchesPath('/path/*/to/*/dir', '/path/placeholder/to/placeholder'))
  t.assert(matchesPath('/path/to/dir/*', '/path/to/dir'))
  t.assert(!matchesPath('/*test', '/'))
  t.assert(matchesPath('/*test', '/test'))
  t.assert(matchesPath('/*test', '/otherTest'))

  /**
   * Trailing (*) wildcard matches recursive subdirs.
   */
  t.assert(matchesPath('/path/*', '/path/placeholder/to/placeholder/dir'))
  t.assert(matchesPath('/path/to/*', '/path/to/oneDir'))
  t.assert(matchesPath('/path/to/*', '/path/to/oneDir/twoDir/threeDir'))

  /**
   * Trailing wildcards match parent dir.
   *
   */
  t.assert(matchesPath('/path/to/dir/*', '/path/to/dir'))
  t.assert(matchesPath('/path/to/dir/*/:placeholder', '/path/to/dir/test'))

  /**
   * Mixed (*) and (:placeholder) wildcards.
   */
  t.assert(matchesPath('/path/*/to/:placeholder/:placeholder/*', '/path/placeholder/to/placeholder/dir/test'))
  t.assert(matchesPath('/path/*/:placeholder', '/path/to/dir'))
  t.assert(matchesPath('/path/:placeholder/:placeholder/*', '/path/to/dir/one/two/three'))
  t.assert(matchesPath('/path/to/dir/*/:placeholder/test', '/path/to/dir/asterisk/placeholder/test'))
})
