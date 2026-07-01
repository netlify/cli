import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { expect, test } from 'vitest'

import hashEdgeFunctions from '../../../../src/utils/deploy/hash-edge-functions.js'
import { temporaryDirectory } from '../../../../src/utils/temporary-file.js'

const sha256 = (contents: string) => createHash('sha256').update(contents).digest('hex')

const writeManifest = async (dir: string, bundles: { asset: string; format: string; contents: string }[]) => {
  await mkdir(dir, { recursive: true })
  await Promise.all(bundles.map(({ asset, contents }) => writeFile(join(dir, asset), contents)))
  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify({ bundles: bundles.map(({ asset, format }) => ({ asset, format })) }),
  )
}

test('declares every bundle format, keyed by the recomputed code_sha', async () => {
  const dir = temporaryDirectory()
  await writeManifest(dir, [
    { asset: 'aaa.tar.gz', format: 'tar', contents: 'tar-bundle-bytes' },
    { asset: 'bbb.eszip', format: 'eszip2', contents: 'eszip-bundle-bytes' },
  ])

  const { edgeFunctions, edgeFnShaMap } = await hashEdgeFunctions(dir, { statusCb() {} })

  const tarSha = sha256('tar-bundle-bytes')
  const eszipSha = sha256('eszip-bundle-bytes')
  // We declare all formats; bitballoon filters and only asks for the ones that ride this path.
  expect(edgeFunctions).toEqual({ tar: tarSha, eszip2: eszipSha })
  expect(Object.keys(edgeFnShaMap).sort()).toEqual([tarSha, eszipSha].sort())
  expect(edgeFnShaMap[tarSha][0]).toMatchObject({
    assetType: 'edge-function',
    filepath: join(dir, 'aaa.tar.gz'),
    normalizedPath: tarSha,
  })
})

test('returns empty maps when there is no dist path', async () => {
  const { edgeFunctions, edgeFnShaMap } = await hashEdgeFunctions(undefined, { statusCb() {} })

  expect(edgeFunctions).toEqual({})
  expect(edgeFnShaMap).toEqual({})
})

test('returns empty maps when the manifest is missing', async () => {
  const dir = temporaryDirectory()
  await mkdir(dir, { recursive: true })

  const { edgeFunctions, edgeFnShaMap } = await hashEdgeFunctions(dir, { statusCb() {} })

  expect(edgeFunctions).toEqual({})
  expect(edgeFnShaMap).toEqual({})
})
