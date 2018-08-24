const test = require('ava')
const hashFns = require('./hash-fns')
const { defaultFilter } = require('./util')

test('hashes files in a folder', async t => {
  const { functions, fnShaMap } = await hashFns(__dirname, { filter: defaultFilter })

  Object.keys(functions).forEach(path => t.truthy(path, 'each file has a path'))
  t.truthy(fnShaMap, 'fnShaMap is returned')
  Object.values(fnShaMap).forEach(fileObjArray =>
    fileObjArray.forEach(fileObj => t.truthy(fileObj.normalizedPath, 'fileObj have a normalizedPath field'))
  )
})
