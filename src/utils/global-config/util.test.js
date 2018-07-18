const test = require('ava')
const { toEnvCase } = require('./util')

test('camelCase to NETLIFY_ENV_CASE', t => {
  const envCase = toEnvCase('fooBar')
  t.is(envCase, 'NETLIFY_FOO_BAR', 'env case conversion works')
  t.pass()
})
