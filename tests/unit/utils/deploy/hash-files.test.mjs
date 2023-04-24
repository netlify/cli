import { Response } from 'node-fetch'
import { expect, test } from 'vitest'

import { DEFAULT_CONCURRENT_HASH } from '../../../../src/utils/deploy/constants.mjs'
import hashFiles from '../../../../src/utils/deploy/hash-files.mjs'
import { withSiteBuilder } from '../../../integration/utils/site-builder.cjs'

test('Hashes files in a folder', async () => {
  await withSiteBuilder('site-with-content', async (builder) => {
    await builder
      .withNetlifyToml({ config: { build: { publish: 'public' } } })
      .withContentFile({
        path: 'public/index.html',
        content: `Root page`,
      })
      .withSymlink({ target: 'public/index.html', path: 'public/file1.html' })
      .withEdgeFunction({ handler: async () => new Response('Edge Function works'), name: 'edge' })
      .buildAsync()

    const netlifyConfigFile = 'netlify.toml'
    const regularDeployFile = 'index.html'
    const symlinkDeployFile = 'file1.html'
    const edgeFnFile = 'edge.js'
    const { files, filesShaMap } = await hashFiles({
      concurrentHash: DEFAULT_CONCURRENT_HASH,
      configPath: `${builder.directory}/netlify.toml`,
      deployFolder: `${builder.directory}/public`,
      edgeFunctionsFolder: `${builder.directory}/netlify/edge-functions`,
      rootDir: builder.directory,
      statusCb() {},
    })

    // 1 config file + 1 regular file + 1 symlink + 1 edge fn file = 4
    expect(Object.entries(files)).toHaveLength(4)
    expect(Object.values(filesShaMap).flat()).toHaveLength(4)

    // config file assertions
    const configFileSha = files[netlifyConfigFile]
    const configFileShaMapEntry = filesShaMap[configFileSha]
    expect(configFileShaMapEntry.length).toBe(1)
    expect(configFileShaMapEntry[0].normalizedPath).toBe('netlify.toml')
    expect(configFileShaMapEntry[0].path).toBe(`${builder.directory}/netlify.toml`)

    // regular file & symlink assertions
    const regularDeployFileSha = files[regularDeployFile]
    const symlinkDeployFileSha = files[symlinkDeployFile]
    const regularDeployFileShaMapEntry = filesShaMap[regularDeployFileSha]
    expect(regularDeployFileShaMapEntry.length).toBe(2)
    expect(regularDeployFileSha).toBe(symlinkDeployFileSha)

    const regularDeployFileShaMapArrayEntry = regularDeployFileShaMapEntry.find(
      (el) => el.normalizedPath === regularDeployFile,
    )
    const symlinkDeployFileShaMapArrayEntry = regularDeployFileShaMapEntry.find(
      (el) => el.normalizedPath === symlinkDeployFile,
    )
    expect(regularDeployFileShaMapArrayEntry).toBeDefined()
    expect(symlinkDeployFileShaMapArrayEntry).toBeDefined()
    expect(regularDeployFileShaMapArrayEntry.normalizedPath).toBe(regularDeployFile)
    expect(symlinkDeployFileShaMapArrayEntry.normalizedPath).toBe(symlinkDeployFile)
    expect(regularDeployFileShaMapArrayEntry.path).toBe(`${builder.directory}/public/${regularDeployFile}`)
    expect(symlinkDeployFileShaMapArrayEntry.path).toBe(`${builder.directory}/public/${symlinkDeployFile}`)

    // edge fn assertions
    const edgeFnNormalized = `.netlify/internal/edge-functions/${edgeFnFile}`
    const edgeFnFileSha = files[edgeFnNormalized]
    const edgeFnFileShaMapEntry = filesShaMap[edgeFnFileSha]
    expect(edgeFnFileShaMapEntry.length).toBe(1)
    expect(edgeFnFileShaMapEntry[0].normalizedPath).toBe(edgeFnNormalized)
    expect(edgeFnFileShaMapEntry[0].path).toBe(`${builder.directory}/netlify/edge-functions/${edgeFnFile}`)
  })
})
