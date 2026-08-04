import path from 'node:path'

import { expect, test } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { DEFAULT_CONCURRENT_HASH } from '../../../../src/utils/deploy/constants.js'
import hashFns from '../../../../src/utils/deploy/hash-fns.js'
import { withSiteBuilder } from '../../../integration/utils/site-builder.js'
import { temporaryDirectory } from '../../../../src/utils/temporary-file.js'

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

test('Populates build_data.bootstrapVersion for v2 functions on direct-zip path', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
      .withFunction({
        path: 'hello.js',
        runtimeAPIVersion: 2,
        handler: (_req: Request) => new Response('Hello'),
      })
      .build()

    const { fnConfig } = await hashFns(new BaseCommand(), [path.join(builder.directory, 'functions')], {
      tmpDir: temporaryDirectory(),
      concurrentHash: DEFAULT_CONCURRENT_HASH,
      statusCb() {},
    })

    expect(fnConfig).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- covered by expectation above
    const helloConfig = fnConfig!.hello as { build_data?: { bootstrapVersion?: string; runtimeAPIVersion?: number } }
    expect(helloConfig).toBeDefined()
    expect(helloConfig.build_data).toBeDefined()
    expect(helloConfig.build_data?.runtimeAPIVersion).toBe(2)
    expect(helloConfig.build_data?.bootstrapVersion).toEqual(expect.any(String))
    expect(helloConfig.build_data?.bootstrapVersion).not.toBe('')
  })
})
