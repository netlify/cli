/* eslint-disable require-await */
import test from 'ava'
import tempy from 'tempy'

import { withSiteBuilder } from '../../../tests/utils/site-builder.js'

import { DEFAULT_CONCURRENT_HASH } from './constants.js'
import { hashFns } from './hash-fns.js'

test('Hashes files in a folder', async (t) => {
  await withSiteBuilder('site-with-functions', async (builder) => {
    await builder
      .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
      .withFunction({
        path: 'hello.js',
        handler: async () => ({ statusCode: 200, body: 'Hello' }),
      })
      .withFunction({
        path: 'goodbye.js',
        handler: async () => ({ statusCode: 200, body: 'Goodbye' }),
      })
      .buildAsync()

    const expectedFunctions = ['hello', 'goodbye']
    const { fnShaMap, functions } = await hashFns(`${builder.directory}/functions`, {
      tmpDir: tempy.directory(),
      concurrentHash: DEFAULT_CONCURRENT_HASH,
      statusCb() {},
    })

    t.is(Object.entries(functions).length, expectedFunctions.length)
    t.is(Object.entries(fnShaMap).length, expectedFunctions.length)

    expectedFunctions.forEach((functionPath) => {
      const sha = functions[functionPath]
      t.truthy(sha, `includes the ${functionPath} file`)

      const functionsObjArray = fnShaMap[sha]
      functionsObjArray.forEach((fileObj) => {
        t.is(
          fileObj.normalizedPath,
          functionPath,
          'functionPath normalizedPath property should equal to function path from functions array',
        )
      })
    })
  })
})
/* eslint-enable require-await */
