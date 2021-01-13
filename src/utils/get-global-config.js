const Configstore = require('configstore')
const memoizeOne = require('memoize-one')
const { v4: uuidv4 } = require('uuid')

const { readFileAsync } = require('../lib/fs')
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

  return configStore
}

// Memoise config result so that we only load it once
module.exports = memoizeOne(getGlobalConfig)
