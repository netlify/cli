import test from 'ava'
import { toEnvCase } from './config'

test('foo', t => {
  const envCase = toEnvCase('fooBar')
  t.is(envCase, 'NETLIFY_FOO_BAR', 'env works correctly')
  t.pass()
})
