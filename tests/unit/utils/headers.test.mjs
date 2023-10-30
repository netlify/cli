import { resolve } from 'path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { headersForPath, parseHeaders } from '../../../src/utils/headers.mjs'
import { createSiteBuilder } from '../../integration/utils/site-builder.mjs'

vi.mock('../../../src/utils/command-helpers.mjs', async () => ({
  ...(await vi.importActual('../../../src/utils/command-helpers.mjs')),
  log: () => {},
}))

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

const parseHeadersFile = async function (context, fixtureName) {
  const normalizedHeadersFile = resolve(context.builder.directory, fixtureName)
  return await parseHeaders({ headersFiles: [normalizedHeadersFile] })
}

// Ignore added properties like `forRegExp`
const normalizeHeader = function ({ for: forPath, values }) {
  return { for: forPath, values }
}

describe('_headers', () => {
  beforeEach(async (context) => {
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

    context.builder = builder
  })

  afterEach(async (context) => {
    await context.builder.cleanupAsync()
  })

  test('syntax validates as expected', async (context) => {
    await expect(parseHeadersFile(context, '_headers')).resolves.not.toThrowError()
  })

  test('does not throw on invalid syntax', async (context) => {
    await expect(parseHeadersFile(context, '_invalid_headers')).resolves.not.toThrowError()
  })

  test('validate rules', async (context) => {
    const rules = await parseHeadersFile(context, '_headers')
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

  test('headersForPath testing', async (context) => {
    const rules = await parseHeadersFile(context, '_headers')
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
})
