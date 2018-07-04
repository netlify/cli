import test from 'ava'
import { toEnvCase } from './config'

test('camelCase to NETLIFY_ENV_CASE', t => {
  const envCase = toEnvCase('fooBar')
  t.is(envCase, 'NETLIFY_FOO_BAR', 'env case conversion works')
  t.pass()
})
