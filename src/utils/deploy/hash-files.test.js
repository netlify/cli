const path = require('path')

const test = require('ava')

const { DEFAULT_CONCURRENT_HASH } = require('./constants')
const hashFiles = require('./hash-files')
const { defaultFilter } = require('./util')

test('Hashes files in a folder', async (t) => {
  const { files, filesShaMap } = await hashFiles(__dirname, path.resolve(__dirname, '../../fixtures/netlify.toml'), {
    filter: defaultFilter,
    concurrentHash: DEFAULT_CONCURRENT_HASH,
    statusCb() {},
  })
  t.truthy(files['netlify.toml'], 'includes the netlify.toml file')
  Object.keys(files).forEach((filePath) => {
    t.truthy(filePath, 'each file has a path')
  })
  t.truthy(filesShaMap, 'filesShaMap is returned')
  Object.values(filesShaMap).forEach((fileObjArray) => {
    fileObjArray.forEach((fileObj) => {
      t.truthy(fileObj.normalizedPath, 'fileObj have a normalizedPath field')
    })
  })
})
