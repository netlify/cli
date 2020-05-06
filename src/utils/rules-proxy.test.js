const path = require('path')
const test = require('ava')
const redirectParser = require('netlify-redirect-parser')
const { getLanguage, parseFile, parseRules } = require('./rules-proxy.js')
const sitePath = path.join(__dirname, '..', '..', 'tests', 'dummy-site')

test('getLanguage', t => {
  const language = getLanguage({ 'accept-language': 'ur' });

  t.is(language, 'ur')
})

test('parseFile: netlify.toml', async t => {
  const rules = await parseFile(redirectParser.parseNetlifyConfig, path.join(sitePath, 'netlify.toml'));
  const expected = [
    {
      path: '/api/*',
      to: '/.netlify/functions/:splat',
      status: 200,
    },
    {
      path: '/something',
      to: '/ping',
      status: 200,
      force: false,
    },
  ]

  t.deepEqual(rules, expected)
})

test('parseFile: _redirects', async t => {
  const rules = await parseFile(redirectParser.parseRedirectsFormat, path.join(sitePath, '_redirects'));
  const expected = [
    {
      path: '/*',
      to: '/index.html',
      status: 200,
    },
  ]

  t.deepEqual(rules, expected)
})


test('parseRules', async t => {
  const files = [path.join(sitePath, 'netlify.toml'), path.join(sitePath, '_redirects')]
  const rules = await parseRules(files);
  const expected = [
    {
      path: '/api/*',
      to: '/.netlify/functions/:splat',
      status: 200,
    },
    {
      path: '/something',
      to: '/ping',
      status: 200,
      force: false,
    },
    {
      path: '/*',
      to: '/index.html',
      status: 200,
    },
  ]

  t.deepEqual(rules, expected)
})
