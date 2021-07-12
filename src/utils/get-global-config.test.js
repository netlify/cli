const os = require('os')
const path = require('path')

const test = require('ava')

const {
  rmdirRecursiveAsync,
  mkdirRecursiveAsync,
  readFileAsync,
  writeFileAsync,
  copyFileAsync,
  rmFileAsync,
} = require('../lib/fs')
const { getPathInHome, getLegacyPathInHome } = require('../lib/settings')

const getGlobalConfig = require('./get-global-config')

const configPath = getPathInHome(['config.json'])
const legacyConfigPath = getLegacyPathInHome(['config.json'])
const tmpConfigBackupPath = path.join(os.tmpdir(), `netlify-config-backup-${Date.now()}`)

test.before('backup current user config if exists', async () => {
  try {
    await copyFileAsync(configPath, tmpConfigBackupPath)
  } catch (_) {}
})

test.after.always('cleanup tmp directory and legacy config', async () => {
  try {
    // Restore user config if exists
    await mkdirRecursiveAsync(getPathInHome([]))
    await copyFileAsync(tmpConfigBackupPath, configPath)
    // Remove tmp backup if exists
    await rmFileAsync(tmpConfigBackupPath)
  } catch (_) {}
  // Remove legacy config path
  await rmdirRecursiveAsync(getLegacyPathInHome([]))
})

test.beforeEach('recreate clean config directories', async () => {
  // Remove config dirs
  await rmdirRecursiveAsync(getPathInHome([]))
  await rmdirRecursiveAsync(getLegacyPathInHome([]))
  // Make config dirs
  await mkdirRecursiveAsync(getPathInHome([]))
  await mkdirRecursiveAsync(getLegacyPathInHome([]))
})

// Not running tests in parallel as we're messing with the same config files

test.serial('should use legacy config values as default if exists', async (t) => {
  const legacyConfig = { someOldKey: 'someOldValue', overrideMe: 'oldValue' }
  const newConfig = { overrideMe: 'newValue' }
  await writeFileAsync(legacyConfigPath, JSON.stringify(legacyConfig))
  await writeFileAsync(configPath, JSON.stringify(newConfig))

  const globalConfig = await getGlobalConfig()
  t.is(globalConfig.get('someOldKey'), legacyConfig.someOldKey)
  t.is(globalConfig.get('overrideMe'), newConfig.overrideMe)
})

test.serial('should not throw if legacy config is invalid JSON', async (t) => {
  await writeFileAsync(legacyConfigPath, 'NotJson')
  await t.notThrowsAsync(getGlobalConfig)
})

test.serial("should create config in netlify's config dir if none exists and store new values", async (t) => {
  // Remove config dirs
  await rmdirRecursiveAsync(getPathInHome([]))
  await rmdirRecursiveAsync(getLegacyPathInHome([]))
  const globalConfig = await getGlobalConfig()
  globalConfig.set('newProp', 'newValue')
  const configFile = JSON.parse(await readFileAsync(configPath))
  t.deepEqual(globalConfig.all, configFile)
})
