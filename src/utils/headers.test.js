const test = require('ava')
const path = require('path')
const { parseHeadersFile, objectForPath } = require('./headers.js')
const { createSiteBuilder } = require('../../tests/utils/siteBuilder')

const headers = [
  { path: '/', headers: ['X-Frame-Options: SAMEORIGIN'] },
  { path: '/*', headers: ['X-Frame-Thing: SAMEORIGIN'] },
  {
    path: '/something/*',
    headers: [
      'X-Frame-Options: DENY',
      'X-XSS-Protection: 1; mode=block',
      'cache-control: max-age=0',
      'cache-control: no-cache',
      'cache-control: no-store',
      'cache-control: must-revalidate',
    ],
  },
  { path: '/:ding/index.html', headers: ['X-Frame-Options: SAMEORIGIN'] },
]

test.before(async t => {
  const builder = createSiteBuilder({ siteName: 'site-for-detecting-server' })
  builder.withHeadersFile({
    headers,
  })

  await builder.buildAsync()

  t.context.builder = builder
})

test('_headers: validate correct parsing', t => {
  const rules = parseHeadersFile(path.resolve(t.context.builder.directory, '_headers'))
  t.deepEqual(rules, {
    '/': {
      'X-Frame-Options': ['SAMEORIGIN'],
    },
    '/*': {
      'X-Frame-Thing': ['SAMEORIGIN'],
    },
    '/something/*': {
      'X-Frame-Options': ['DENY'],
      'X-XSS-Protection': ['1; mode=block'],
      'cache-control': ['max-age=0', 'no-cache', 'no-store', 'must-revalidate'],
    },
    '/:ding/index.html': {
      'X-Frame-Options': ['SAMEORIGIN'],
    },
  })
})

test('_headers: rulesForPath testing', t => {
  const rules = parseHeadersFile(path.resolve(t.context.builder.directory, '_headers'))
  t.deepEqual(objectForPath(rules, '/'), {
    'X-Frame-Options': ['SAMEORIGIN'],
  })
  t.deepEqual(objectForPath(rules, '/ding'), {
    'X-Frame-Thing': ['SAMEORIGIN'],
  })
  t.deepEqual(objectForPath(rules, '/something/ding'), {
    'X-Frame-Thing': ['SAMEORIGIN'],
    'X-Frame-Options': ['DENY'],
    'X-XSS-Protection': ['1; mode=block'],
    'cache-control': ['max-age=0', 'no-cache', 'no-store', 'must-revalidate'],
  })
  t.deepEqual(objectForPath(rules, '/ding/index.html'), {
    'X-Frame-Options': ['SAMEORIGIN'],
    'X-Frame-Thing': ['SAMEORIGIN'],
  })
})

test.after(async t => {
  await t.context.builder.cleanupAsync()
})
