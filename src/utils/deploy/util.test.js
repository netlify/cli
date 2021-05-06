const { join } = require('path')

const test = require('ava')

const { normalizePath, defaultFilter } = require('./util')

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

const filteredFiles = ['foo/bar/baz.js', 'directory/.well-known', '__MACOSX']
filteredFiles.forEach((filePath) => {
  test(`filters ${filePath}`, (t) => {
    t.true(defaultFilter(filePath))
  })
})

const unfilteredFiles = [null, undefined, 'directory/node_modules', 'directory/.gitignore']
unfilteredFiles.forEach((filePath) => {
  test(`does not filter ${filePath}`, (t) => {
    t.false(defaultFilter(filePath))
  })
})
