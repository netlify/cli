const { copyFile, mkdir, readFile, unlink, writeFile } = require('fs').promises
const os = require('os')
const path = require('path')

const { rmdirRecursiveAsync } = require('../lib/fs')
const { getLegacyPathInHome, getPathInHome } = require('../lib/settings')

const getGlobalConfig = require('./get-global-config')

const configPath = getPathInHome(['config.json'])
const legacyConfigPath = getLegacyPathInHome(['config.json'])
const tmpConfigBackupPath = path.join(os.tmpdir(), `netlify-config-backup-${Date.now()}`)

// backup current user config if exists
beforeAll(async () => {
  try {
    await copyFile(configPath, tmpConfigBackupPath)
  } catch {}
})

// cleanup tmp directory and legacy config
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

// recreate clean config directories
beforeEach(async () => {
  // Remove config dirs
  await rmdirRecursiveAsync(getPathInHome([]))
  await rmdirRecursiveAsync(getLegacyPathInHome([]))
  // Make config dirs
  await mkdir(getPathInHome([]))
  await mkdir(getLegacyPathInHome([]))
})

// Not running tests in parallel as we're messing with the same config files

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
  await getGlobalConfig()
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
