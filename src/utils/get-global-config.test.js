const os = require('os')
const path = require('path')

const test = require('ava')

const { statAsync, writeFileAsync, copyFileAsync, rmFileAsync } = require('../lib/fs')
const { getPathInHome, getLegacyPathInHome } = require('../lib/settings')

const getGlobalConfig = require('./get-global-config.js')

const configPath = getPathInHome(['config.json'])
const legacyConfigPath = getLegacyPathInHome(['config.json'])
const tmpConfigBackupPath = path.join(os.tmpdir(), `netlify-config-backup-${Date.now()}`)

test.before('backup current user config', async () => {
  await copyFileAsync(configPath, tmpConfigBackupPath)
})

test.after.always('cleanup tmp directory and legacy config', async () => {
  await copyFileAsync(tmpConfigBackupPath, configPath)
  await rmFileAsync(tmpConfigBackupPath)
  // Remove legacy config if exists
  try {
    await rmFileAsync(legacyConfigPath)
  } catch (_) {}
})

// Not running tests in parallel as we're messing with the same config files

test.serial('should use legacy config values as default if exists and delete it', async (t) => {
  const legacyConfig = { someOldKey: 'someOldValue', overrideMe: 'oldValue' }
  const newConfig = { overrideMe: 'newValue' }
  await writeFileAsync(legacyConfigPath, JSON.stringify(legacyConfig))
  await writeFileAsync(configPath, JSON.stringify(newConfig))

  const globalConfig = await getGlobalConfig()
  t.is(globalConfig.get('someOldKey'), legacyConfig.someOldKey)
  t.is(globalConfig.get('overrideMe'), newConfig.overrideMe)
  await t.throwsAsync(statAsync(legacyConfigPath))
})

test.serial('should not throw if legacy config is invalid JSON', async (t) => {
  await writeFileAsync(legacyConfigPath, 'NotJson')
  await t.notThrowsAsync(getGlobalConfig)
})

test.serial("should create config in netlify's config dir if none exist", async (t) => {
  await rmFileAsync(configPath)
  await rmFileAsync(legacyConfigPath)
  await getGlobalConfig()
  await t.notThrowsAsync(statAsync(configPath))
})
