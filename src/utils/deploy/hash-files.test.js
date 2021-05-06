const path = require('path')

const test = require('ava')

const { DEFAULT_CONCURRENT_HASH } = require('./constants')
const { hashFiles } = require('./hash-files')

test('Hashes files in a folder', async (t) => {
  const dirname = path.resolve(__dirname, '../../../tests/site-with-functions')
  const expectedFiles = [
    'netlify.toml',
    'netlify/functions/function-1.js',
    'netlify/functions/function-2.js',
    'lib/util.js',
  ]
  const { files, filesShaMap } = await hashFiles(dirname, path.join(dirname, 'netlify.toml'), {
    filter: () => true,
    concurrentHash: DEFAULT_CONCURRENT_HASH,
    statusCb() {},
  })

  expectedFiles.forEach((filePath) => {
    t.truthy(files[filePath], `includes the ${filePath} file`)
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
