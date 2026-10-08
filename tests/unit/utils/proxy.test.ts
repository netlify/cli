import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { afterEach, describe, expect, test } from 'vitest'

import { getStatic } from '../../../src/utils/proxy.js'

describe('getStatic', () => {
  const directories: string[] = []

  const publishFolder = async (files: string[]) => {
    const dir = await mkdtemp(join(tmpdir(), 'netlify-cli-proxy-'))
    directories.push(dir)
    for (const file of files) {
      const filePath = join(dir, ...file.split('/'))
      await mkdir(join(filePath, '..'), { recursive: true })
      await writeFile(filePath, '')
    }
    return dir
  }

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  test('returns a URL path for a file at the root of the publish folder', async () => {
    const dir = await publishFolder(['manifest.json'])

    expect(await getStatic('/manifest.json', dir)).toBe('/manifest.json')
  })

  test('uses forward slashes for a file in a subdirectory', async () => {
    const dir = await publishFolder(['css/styles.css'])

    expect(await getStatic('/css/styles.css', dir)).toBe('/css/styles.css')
  })

  test('uses forward slashes for a file in a deeply nested subdirectory', async () => {
    const dir = await publishFolder(['assets/img/icons/logo.svg'])

    expect(await getStatic('/assets/img/icons/logo.svg', dir)).toBe('/assets/img/icons/logo.svg')
  })

  test('uses forward slashes when resolving a pretty URL to an index file', async () => {
    const dir = await publishFolder(['docs/guide/index.html'])

    expect(await getStatic('/docs/guide/', dir)).toBe('/docs/guide/index.html')
  })

  test('returns false when no file matches', async () => {
    const dir = await publishFolder(['css/styles.css'])

    expect(await getStatic('/css/missing.css', dir)).toBe(false)
  })
})
