import { describe, expect, test } from 'vitest'

import isFunction from '../../../../src/utils/proxy/is-function.mjs'

describe('getCanonicalPath', () => {
  test('returns true when port set and function url', () => {
    expect(isFunction(123, '/.netlify/functions/hello')).toEqual(true)
  })

  test('returns true when port set and builder url', () => {
    expect(isFunction(123, '/.netlify/builders/hello')).toEqual(true)
  })

  test('returns false when port set but not function url', () => {
    expect(isFunction(123, '/other/hello')).toEqual(false)
  })

  test('returns false when port not set', () => {
    expect(isFunction(undefined, '/.netlify/functions/hello')).toEqual(false)
  })
})
