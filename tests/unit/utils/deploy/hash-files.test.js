import { expect, test } from 'vitest'

import { DEFAULT_CONCURRENT_HASH } from '../../../../src/utils/deploy/constants.js'
import hashFiles from '../../../../src/utils/deploy/hash-files.js'
import { withSiteBuilder } from '../../../integration/utils/site-builder.js'

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
    const { files, filesShaMap } = await hashFiles({
      directories: [builder.directory, `${builder.directory}/netlify.toml`],
      filter: () => true,
      concurrentHash: DEFAULT_CONCURRENT_HASH,
      statusCb() {},
    })

    expect(Object.entries(files)).toHaveLength(expectedFiles.length)
    expect(Object.entries(filesShaMap)).toHaveLength(expectedFiles.length)

    expectedFiles.forEach((filePath) => {
      const sha = files[filePath]
      expect(sha).toBeDefined()

      const fileObjArray = filesShaMap[sha]
      fileObjArray.forEach((fileObj) => {
        expect(fileObj.normalizedPath).toBe(filePath)
      })
    })
  })
})
