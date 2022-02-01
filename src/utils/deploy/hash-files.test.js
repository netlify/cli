const { withSiteBuilder } = require('../../../tests/utils/site-builder')

const { DEFAULT_CONCURRENT_HASH } = require('./constants')
const { hashFiles } = require('./hash-files')

test('Hashes files in a folder', async () => {
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

    expect(Object.entries(files).length).toBe(expectedFiles.length)
    expect(Object.entries(filesShaMap).length).toBe(expectedFiles.length)

    expectedFiles.forEach((filePath) => {
      const sha = files[filePath]
      expect(sha).toBeTruthy()

      const fileObjArray = filesShaMap[sha]
      fileObjArray.forEach((fileObj) => {
        expect(fileObj.normalizedPath).toBe(filePath)
      })
    })
  })
})
