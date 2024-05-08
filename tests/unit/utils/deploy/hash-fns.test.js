import { temporaryDirectory } from 'tempy'
import { expect, test } from 'vitest'

import BaseCommand from '../../../../dist/commands/base-command.js'
import { DEFAULT_CONCURRENT_HASH } from '../../../../dist/utils/deploy/constants.js'
import hashFns from '../../../../dist/utils/deploy/hash-fns.js'
import { withSiteBuilder } from '../../../integration/utils/site-builder.ts'

test('Hashes files in a folder', async (t) => {
  await withSiteBuilder(t, async (builder) => {
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
    const { fnShaMap, functions } = await hashFns(new BaseCommand(), `${builder.directory}/functions`, {
      tmpDir: temporaryDirectory(),
      concurrentHash: DEFAULT_CONCURRENT_HASH,
      statusCb() {},
    })

    expect(Object.entries(functions)).toHaveLength(expectedFunctions.length)
    expect(Object.entries(fnShaMap)).toHaveLength(expectedFunctions.length)

    expectedFunctions.forEach((functionPath) => {
      const sha = functions[functionPath]
      expect(sha).toBeDefined()

      const functionsObjArray = fnShaMap[sha]
      functionsObjArray.forEach((fileObj) => {
        expect(fileObj.normalizedPath).toBe(functionPath)
      })
    })
  })
})
