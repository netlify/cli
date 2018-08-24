const test = require('ava')
const { toEnvCase, isDotProp } = require('./util')

test('camelCase to NETLIFY_ENV_CASE', t => {
  const envCase = toEnvCase('fooBar')
  t.is(envCase, 'NETLIFY_FOO_BAR', 'env case conversion works')
  t.pass()
})

test('isDotProp detects doPropPaths', t => {
  t.true(isDotProp('foo.bar.baz'))
  t.false(isDotProp('foo_baz'))
  t.true(isDotProp('foo_baz[biz]'))
})
