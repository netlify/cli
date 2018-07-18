const test = require('ava')
const fileHasher = require('./file-hasher')

test('hashes files in a folder', async t => {
  const { files, shaMap } = await fileHasher(__dirname)

  Object.keys(files).forEach(path => t.true(path.startsWith('/'), 'paths use unix sep'))
  t.truthy(shaMap, 'shaMap is returned')
  Object.values(shaMap).forEach(fileObjArray =>
    fileObjArray.forEach(fileObj => t.truthy(fileObj.normalizedPath, 'fileObj have a normalizedPath field'))
  )
})
