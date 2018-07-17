const test = require('ava')
const fileHasher = require('./file-hasher')
const { normalizePath } = fileHasher

test('hashes files in a folder', async t => {
  let progressFired = false

  const { files, shaMap } = await fileHasher(__dirname, {
    onProgress: progress => {
      progressFired = true
      t.truthy(progress.total, 'progress has a total field')
      t.truthy(progress.current, 'progress has a current field')
    }
  })
  t.true(progressFired, 'Progress callback fired')

  Object.keys(files).forEach(path => t.true(path.startsWith('/'), 'paths use unix sep'))
  t.truthy(shaMap, 'shaMap is returned')
  Object.values(shaMap).forEach(fileObjArray =>
    fileObjArray.forEach(fileObj => t.truthy(fileObj.normalizedPath, 'fileObjs have a normalizedPath field'))
  )
})

test('normalizes relative file paths', t => {
  const cases = [
    {
      input: 'foo/bar/baz.js',
      expect: '/foo/bar/baz.js',
      msg: 'relative paths are normalized',
      skip: process.platform === 'win32'
    },
    {
      input: 'beep\\impl\\bbb',
      expect: '/beep/impl/bbb',
      msg: 'relative windows paths are normalized',
      skip: process.platform !== 'win32'
    }
  ]

  cases.forEach(c => {
    if (c.skip) return
    t.is(normalizePath(c.input), c.expect, c.msg)
  })
})
