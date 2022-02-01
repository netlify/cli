const { join } = require('path')

const { normalizePath } = require('./util')

test('normalizes relative file paths', () => {
  const input = join('foo', 'bar', 'baz.js')
  expect(normalizePath(input)).toBe('foo/bar/baz.js')
})

test('normalizePath should throw the error if name is invalid', () => {
  expect(() => normalizePath('invalid name#')).toThrow()
  expect(() => normalizePath('invalid name?')).toThrow()
  expect(() => normalizePath('??')).toThrow()
  expect(() => normalizePath('#')).toThrow()
})
