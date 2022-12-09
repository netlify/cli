import { copyFile, mkdir, readFile, unlink, writeFile } from 'fs/promises'
import os from 'os'
import { join } from 'path'

import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'

import { rmdirRecursiveAsync } from '../../../src/lib/fs.cjs'
import { getLegacyPathInHome, getPathInHome } from '../../../src/lib/settings.cjs'
import getGlobalConfig, { resetConfigCache } from '../../../src/utils/get-global-config.mjs'

const configPath = getPathInHome(['config.json'])
const legacyConfigPath = getLegacyPathInHome(['config.json'])
const tmpConfigBackupPath = join(os.tmpdir(), `netlify-config-backup-${Date.now()}`)

beforeAll(async () => {
  try {
    // backup current user config if exists
    await copyFile(configPath, tmpConfigBackupPath)
  } catch {}
})

afterAll(async () => {
  try {
    // Restore user config if exists
    await mkdir(getPathInHome([]))
    await copyFile(tmpConfigBackupPath, configPath)
    // Remove tmp backup if exists
    await unlink(tmpConfigBackupPath)
  } catch {}
  // Remove legacy config path
  await rmdirRecursiveAsync(getLegacyPathInHome([]))
})

beforeEach(async () => {
  // Remove config dirs
  await rmdirRecursiveAsync(getPathInHome([]))
  await rmdirRecursiveAsync(getLegacyPathInHome([]))
  // Make config dirs
  await mkdir(getPathInHome([]))
  await mkdir(getLegacyPathInHome([]))

  // reset the memoized config for the tests
  resetConfigCache()
})

test('should use legacy config values as default if exists', async () => {
  const legacyConfig = { someOldKey: 'someOldValue', overrideMe: 'oldValue' }
  const newConfig = { overrideMe: 'newValue' }
  await writeFile(legacyConfigPath, JSON.stringify(legacyConfig))
  await writeFile(configPath, JSON.stringify(newConfig))

  const globalConfig = await getGlobalConfig()

  expect(globalConfig.get('someOldKey')).toBe(legacyConfig.someOldKey)
  expect(globalConfig.get('overrideMe')).toBe(newConfig.overrideMe)
})

test('should not throw if legacy config is invalid JSON', async () => {
  await writeFile(legacyConfigPath, 'NotJson')

  await expect(getGlobalConfig()).resolves.not.toThrowError()
})

test("should create config in netlify's config dir if none exists and store new values", async () => {
  // Remove config dirs
  await rmdirRecursiveAsync(getPathInHome([]))
  await rmdirRecursiveAsync(getLegacyPathInHome([]))
  const globalConfig = await getGlobalConfig()
  globalConfig.set('newProp', 'newValue')
  const configFile = JSON.parse(await readFile(configPath, 'utf-8'))

  expect(globalConfig.all).toEqual(configFile)
})
