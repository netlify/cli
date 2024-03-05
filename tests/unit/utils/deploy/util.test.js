import { join } from 'path'

import { describe, expect, test } from 'vitest'

import { normalizePath } from '../../../../dist/utils/deploy/util.js'

describe('normalizePath', () => {
  test('normalizes relative file paths', () => {
    const input = join('foo', 'bar', 'baz.js')
    expect(normalizePath(input)).toBe('foo/bar/baz.js')
  })

  test('normalizePath should throw the error if name is invalid', () => {
    expect(() => normalizePath('invalid name#')).toThrowError()
    expect(() => normalizePath('invalid name?')).toThrowError()
    expect(() => normalizePath('??')).toThrowError()
    expect(() => normalizePath('#')).toThrowError()
  })
})
