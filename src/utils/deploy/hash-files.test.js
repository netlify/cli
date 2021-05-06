const path = require('path')

const test = require('ava')

const { withSiteBuilder } = require('../../../tests/utils/site-builder')

const { DEFAULT_CONCURRENT_HASH } = require('./constants')
const { hashFiles } = require('./hash-files')

test('Hashes files in a folder', async (t) => {
  await withSiteBuilder('site-with-override', async (builder) => {
    builder
      .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
      .withContentFile({
        path: 'lib/util.js',
        content: `module.exports = { one: 1 }`,
      })
      .withContentFiles([
        {
          path: 'functions/function-1.js',
          content: `
const { one } = require('../../lib/util')

module.exports.handler = async () => ({ statusCode: 200, body: one })
`,
        },
        {
          path: 'functions/function-2.js',
          content: `
const { one } = require('../../lib/util')

module.exports.handler = async () => ({ statusCode: 200, body: one })
`,
        },
      ])

    await builder.buildAsync()

    const expectedFiles = ['netlify.toml', 'functions/function-1.js', 'functions/function-2.js', 'lib/util.js']
    const { files, filesShaMap } = await hashFiles(builder.directory, path.join(builder.directory, 'netlify.toml'), {
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
})
