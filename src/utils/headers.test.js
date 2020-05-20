const test = require('ava')
const path = require('path')
const { parseHeadersFile, objectForPath } = require('./headers.js')
const sitePath = path.join(__dirname, '..', '..', 'tests', 'dummy-site')

test('_headers: validate correct parsing', t => {
  const rules = parseHeadersFile(path.resolve(sitePath, '_headers'))

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
  const rules = parseHeadersFile(path.resolve(sitePath, '_headers'))
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
