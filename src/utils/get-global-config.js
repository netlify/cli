const Configstore = require('configstore')
const { v4: uuidv4 } = require('uuid')

const { rmFileAsync, readFileAsync } = require('../lib/fs')
const { getPathInHome, getLegacyPathInHome } = require('../lib/settings')

const globalConfigDefaults = {
  /* disable stats from being sent to Netlify */
  telemetryDisabled: false,
  /* cliId */
  cliId: uuidv4(),
}

const getGlobalConfig = async function () {
  const configPath = getPathInHome(['config.json'])
  // Legacy config file in home ~/.netlify/config.json
  const legacyPath = getLegacyPathInHome(['config.json'])
  let legacyConfig
  // Read legacy config if exists
  try {
    legacyConfig = JSON.parse(await readFileAsync(legacyPath))
  } catch (_) {}
  // Use legacy config as default values
  const defaults = { ...globalConfigDefaults, ...legacyConfig }
  const configStore = new Configstore(null, defaults, { configPath })

  // If legacy config exsists we can now safely delete it
  if (legacyConfig) {
    try {
      await rmFileAsync(legacyPath)
    } catch (_) {}
  }
  return configStore
}

module.exports = getGlobalConfig
