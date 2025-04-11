import { expect, test } from 'vitest'

import { DEFAULT_CONCURRENT_HASH } from '../../../../dist/utils/deploy/constants.js'
import hashFiles from '../../../../dist/utils/deploy/hash-files.js'
import { withSiteBuilder } from '../../../integration/utils/site-builder.js'

test('Hashes files in a folder', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({ config: { build: { publish: 'public' } } })
      .withContentFile({
        path: 'public/index.html',
        content: `Root page`,
      })
      .build()

    const expectedFiles = ['netlify.toml', 'public/index.html']
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ directories: string[]; filter:... Remove this comment to see the full error message
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
