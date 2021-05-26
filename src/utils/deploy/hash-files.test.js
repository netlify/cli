const test = require('ava')

const { withSiteBuilder } = require('../../../tests/utils/site-builder')

const { DEFAULT_CONCURRENT_HASH } = require('./constants')
const { hashFiles } = require('./hash-files')

test('Hashes files in a folder', async (t) => {
  await withSiteBuilder('site-with-content', async (builder) => {
    await builder
      .withNetlifyToml({ config: { build: { publish: 'public' } } })
      .withContentFile({
        path: 'public/index.html',
        content: `Root page`,
      })
      .buildAsync()

    const expectedFiles = ['netlify.toml', 'public/index.html']
    const { files, filesShaMap } = await hashFiles(builder.directory, `${builder.directory}/netlify.toml`, {
      filter: () => true,
      concurrentHash: DEFAULT_CONCURRENT_HASH,
      statusCb() {},
    })

    t.is(Object.entries(files).length, expectedFiles.length)
    t.is(Object.entries(filesShaMap).length, expectedFiles.length)

    expectedFiles.forEach((filePath) => {
      const sha = files[filePath]
      t.truthy(sha, `includes the ${filePath} file`)

      const fileObjArray = filesShaMap[sha]
      fileObjArray.forEach((fileObj) => {
        t.is(
          fileObj.normalizedPath,
          filePath,
          'fileObj normalizedPath property should equal to file path from files array',
        )
      })
    })
  })
})
