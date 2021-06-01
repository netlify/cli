/* eslint-disable require-await */
const test = require('ava')
const tempy = require('tempy')

const { withSiteBuilder } = require('../../../tests/utils/site-builder')

const { DEFAULT_CONCURRENT_HASH } = require('./constants')
const { hashFns } = require('./hash-fns')

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
    const { functions, fnShaMap } = await hashFns(`${builder.directory}/functions`, {
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
