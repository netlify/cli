const test = require('ava')
const { normalizePath } = require('./util')

test('normalizes relative file paths', t => {
  const cases = [
    {
      input: 'foo/bar/baz.js',
      expect: 'foo/bar/baz.js',
      msg: 'relative paths are normalized',
      skip: process.platform === 'win32'
    },
    {
      input: 'beep\\impl\\bbb',
      expect: 'beep/impl/bbb',
      msg: 'relative windows paths are normalized',
      skip: process.platform !== 'win32'
    }
  ]

  cases.forEach(c => {
    if (c.skip) return
    t.is(normalizePath(c.input), c.expect, c.msg)
  })
})
