import { resolve } from 'path'

import { describe, expect, it as baseIt, vi } from 'vitest'

import { headersForPath, parseHeaders } from '../../../src/utils/headers.js'
import { createSiteBuilder, type SiteBuilder } from '../../integration/utils/site-builder.js'

vi.mock('../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../src/utils/command-helpers.js')),
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

const parseHeadersFile = async function (context: { builder: { directory: string } }, fixtureName: string) {
  const normalizedHeadersFile = resolve(context.builder.directory, fixtureName)
  // TODO(serhalp): Lazy test type. Create a factory and use it here.
  // @ts-expect-error TS(2322) FIXME: Type '{}' is not assignable to type 'NormalizedCac... Remove this comment to see the full error message
  return await parseHeaders({ config: {}, headersFiles: [normalizedHeadersFile] })
}

// Ignore added properties like `forRegExp`
const normalizeHeader = function <T>({ for: forPath, values }: { for: string; values: T }) {
  return { for: forPath, values }
}

describe('_headers', () => {
  const it = baseIt.extend<{ builder: SiteBuilder }>({
    builder: async (
      // eslint-disable-next-line no-empty-pattern
      {},
      use,
    ) => {
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

      await builder.build()

      await use(builder)

      await builder.cleanup()
    },
  })

  it('syntax validates as expected', async ({ builder }) => {
    await expect(parseHeadersFile({ builder }, '_headers')).resolves.not.toThrowError()
  })

  it('does not throw on invalid syntax', async ({ builder }) => {
    await expect(parseHeadersFile({ builder }, '_invalid_headers')).resolves.not.toThrowError()
  })

  it('validate rules', async ({ builder }) => {
    const rules = await parseHeadersFile({ builder }, '_headers')
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

  it('headersForPath testing', async ({ builder }) => {
    const rules = await parseHeadersFile({ builder }, '_headers')
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
