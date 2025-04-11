import path from 'node:path'

import { temporaryDirectory } from 'tempy'
import { expect, test } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { DEFAULT_CONCURRENT_HASH } from '../../../../src/utils/deploy/constants.js'
import hashFns from '../../../../src/utils/deploy/hash-fns.js'
import { withSiteBuilder } from '../../../integration/utils/site-builder.js'

test('Hashes files in a folder', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
      .withFunction({
        path: 'hello.js',
        handler: async () => Promise.resolve({ statusCode: 200, body: 'Hello' }),
      })
      .withFunction({
        path: 'goodbye.js',
        handler: async () => Promise.resolve({ statusCode: 200, body: 'Goodbye' }),
      })
      .build()

    const expectedFunctions = ['hello', 'goodbye']
    const { fnShaMap, functions } = await hashFns(new BaseCommand(), [path.join(builder.directory, 'functions')], {
      tmpDir: temporaryDirectory(),
      concurrentHash: DEFAULT_CONCURRENT_HASH,
      statusCb() {},
    })

    expect(Object.entries(functions)).toHaveLength(expectedFunctions.length)
    expect(Object.entries(fnShaMap ?? {})).toHaveLength(expectedFunctions.length)

    expectedFunctions.forEach((functionPath) => {
      const sha = functions[functionPath]
      expect(sha).toBeDefined()

      expect(fnShaMap).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- FIXME
      const functionsObjArray = fnShaMap![sha]
      functionsObjArray.forEach((fileObj) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- FIXME
        expect(fileObj.normalizedPath).toBe(functionPath)
      })
    })
  })
})
