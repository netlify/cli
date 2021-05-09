const { join } = require('path')

const test = require('ava')

const { normalizePath } = require('./util')

test('normalizes relative file paths', (t) => {
  const input = join('foo', 'bar', 'baz.js')
  t.is(normalizePath(input), 'foo/bar/baz.js')
})

test('normalizePath should throw the error if name is invalid', (t) => {
  t.throws(() => normalizePath('invalid name#'))
  t.throws(() => normalizePath('invalid name?'))
  t.throws(() => normalizePath('??'))
  t.throws(() => normalizePath('#'))
})
