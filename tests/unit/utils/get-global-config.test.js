import { existsSync } from 'fs'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import os from 'os'
import { join } from 'path'

import { copy } from 'fs-extra'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'

import { getLegacyPathInHome, getPathInHome } from '../../../dist/lib/settings.js'
import getGlobalConfig, { resetConfigCache } from '../../../dist/utils/get-global-config.js'

const configFilePath = getPathInHome(['config.json'])
const configPath = getPathInHome([])

const legacyConfigFilePath = getLegacyPathInHome(['config.json'])

const legacyConfigPath = getLegacyPathInHome([''])
const tmpConfigBackupPath = join(os.tmpdir(), `netlify-config-backup-${Date.now()}`)

beforeAll(async () => {
  // backup current user config directory
  if (existsSync(configPath)) {
    await copy(configPath, tmpConfigBackupPath)
  }
})

afterAll(async () => {
  // Remove legacy config path
  await rm(legacyConfigPath, { force: true, recursive: true })

  // Remove config path
  await rm(configPath, { force: true, recursive: true })

  // Restore user config directory if exists
  if (existsSync(tmpConfigBackupPath)) {
    await mkdir(configPath)
    await copy(tmpConfigBackupPath, configPath)
    // Remove tmp backup
    await rm(tmpConfigBackupPath, { force: true, recursive: true })
  }
})

beforeEach(async () => {
  // Remove config dirs
  await rm(configPath, { force: true, recursive: true })
  await rm(legacyConfigPath, { force: true, recursive: true })
  // Make config dirs
  await mkdir(configPath)
  await mkdir(legacyConfigPath)

  // reset the memoized config for the tests
  resetConfigCache()
})

test('should use legacy config values as default if exists', async () => {
  const legacyConfig = { someOldKey: 'someOldValue', overrideMe: 'oldValue' }
  const newConfig = { overrideMe: 'newValue' }
  await writeFile(legacyConfigFilePath, JSON.stringify(legacyConfig))
  await writeFile(configFilePath, JSON.stringify(newConfig))

  const globalConfig = await getGlobalConfig()

  expect(globalConfig.get('someOldKey')).toBe(legacyConfig.someOldKey)
  expect(globalConfig.get('overrideMe')).toBe(newConfig.overrideMe)
})

test('should not throw if legacy config is invalid JSON', async () => {
  await writeFile(legacyConfigFilePath, 'NotJson')

  await expect(getGlobalConfig()).resolves.not.toThrowError()
})

test("should create config in netlify's config dir if none exists and store new values", async () => {
  // Remove config dirs
  await rm(getPathInHome([]), { force: true, recursive: true })

  await rm(getLegacyPathInHome([]), { force: true, recursive: true })
  const globalConfig = await getGlobalConfig()
  globalConfig.set('newProp', 'newValue')
  const configFile = JSON.parse(await readFile(configFilePath, 'utf-8'))

  expect(globalConfig.all).toEqual(configFile)
})
