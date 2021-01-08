const Configstore = require('configstore')
const { v4: uuidv4 } = require('uuid')

const { readFileAsync } = require('../lib/fs')
const { getPathInHome, getLegacyPathInHome } = require('../lib/settings')

const globalConfigDefaults = {
  /* disable stats from being sent to Netlify */
  telemetryDisabled: false,
  /* cliId */
  cliId: uuidv4(),
}

const globalConfigOptions = {
  configPath: getPathInHome(['config.json']),
}

const getGlobalConfig = async function ({ log }) {
  // Legacy config file in home ~/.netlify/config.json
  const legacyPath = getLegacyPathInHome(['config.json'])
  let legacyConfig
  try {
    legacyConfig = await readFileAsync(legacyPath)
    log(`Found existing legacy config in ${legacyPath}`)
  } catch (_) {
    // If file doesn't exist just move on
  }
  const defaults = { ...globalConfigDefaults, ...legacyConfig }
  return new Configstore(null, defaults, globalConfigOptions)
}

module.exports = getGlobalConfig
