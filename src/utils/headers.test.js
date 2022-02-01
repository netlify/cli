const path = require('path')

const { createSiteBuilder } = require('../../tests/utils/site-builder')

const { headersForPath, parseHeaders } = require('./headers')

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

/** @type {ReturnType<createSiteBuilder>} */
let builder

beforeAll(async () => {
  builder = createSiteBuilder({ siteName: 'site-for-detecting-server' })
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
})

afterAll(async () => {
  await builder.cleanupAsync()
})

/**
 *
 * @param {string} fixtureName
 * @returns {Promise<any>}
 */
const parseHeadersFile = async function (fixtureName) {
  const normalizedHeadersFile = path.resolve(builder.directory, fixtureName)
  return await parseHeaders({ headersFiles: [normalizedHeadersFile] })
}

// Ignore added properties like `forRegExp`
const normalizeHeader = function ({ for: forPath, values }) {
  return { for: forPath, values }
}

/**
 * Pass if we can load the test headers without throwing an error.
 */
test('_headers: syntax validates as expected', async () => {
  await parseHeadersFile('_headers')
})

test('_headers: does not throw on invalid syntax', async () => {
  await parseHeadersFile('_invalid_headers')
})

test('_headers: validate rules', async () => {
  const rules = await parseHeadersFile('_headers')
  const normalizedHeaders = rules.map(normalizeHeader)
  expect(normalizedHeaders).toEqual([
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

test('_headers: headersForPath testing', async () => {
  const rules = await parseHeadersFile('_headers')
  expect(headersForPath(rules, '/')).toEqual({
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Frame-Thing': 'SAMEORIGIN',
  })
  expect(headersForPath(rules, '/placeholder')).toEqual({
    'X-Frame-Thing': 'SAMEORIGIN',
  })
  expect(headersForPath(rules, '/static-path/placeholder')).toEqual({
    'X-Frame-Thing': 'SAMEORIGIN',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'cache-control': 'max-age=0, no-cache, no-store, must-revalidate',
  })
  expect(headersForPath(rules, '/static-path')).toEqual({
    'X-Frame-Thing': 'SAMEORIGIN',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'cache-control': 'max-age=0, no-cache, no-store, must-revalidate',
  })
  expect(headersForPath(rules, '/placeholder/index.html')).toEqual({
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Frame-Thing': 'SAMEORIGIN',
  })
  expect(headersForPath(rules, '/placeholder/_next/static/chunks/placeholder')).toEqual({
    'X-Frame-Thing': 'SAMEORIGIN',
    'cache-control': 'public, max-age=31536000, immutable',
  })
  expect(headersForPath(rules, '/directory/placeholder/test.html')).toEqual({
    'X-Frame-Thing': 'SAMEORIGIN',
    'X-Frame-Options': 'test',
  })
})
