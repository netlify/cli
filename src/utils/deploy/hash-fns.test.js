/* eslint-disable require-await */
const tempy = require('tempy')

const { withSiteBuilder } = require('../../../tests/utils/site-builder')

const { DEFAULT_CONCURRENT_HASH } = require('./constants')
const { hashFns } = require('./hash-fns')

test('Hashes files in a folder', async () => {
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

    expect(Object.entries(functions).length).toBe(expectedFunctions.length)
    expect(Object.entries(fnShaMap).length).toBe(expectedFunctions.length)

    expectedFunctions.forEach((functionPath) => {
      const sha = functions[functionPath]
      expect(sha).toBeTruthy()

      const functionsObjArray = fnShaMap[sha]
      functionsObjArray.forEach((fileObj) => {
        expect(fileObj.normalizedPath).toBe(functionPath)
      })
    })
  })
})
/* eslint-enable require-await */
