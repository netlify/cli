const { readFile } = require('fs').promises

const Configstore = require('configstore')
const memoizeOne = require('memoize-one')
const { v4: uuidv4 } = require('uuid')

const { getLegacyPathInHome, getPathInHome } = require('../lib/settings')

const globalConfigDefaults = {
  /* disable stats from being sent to Netlify */
  telemetryDisabled: false,
  /* cliId */
  cliId: uuidv4(),
}

const getGlobalConfigOnce = async function () {
  const configPath = getPathInHome(['config.json'])
  // Legacy config file in home ~/.netlify/config.json
  const legacyPath = getLegacyPathInHome(['config.json'])
  let legacyConfig
  // Read legacy config if exists
  try {
    legacyConfig = JSON.parse(await readFile(legacyPath))
  } catch {}
  // Use legacy config as default values
  const defaults = { ...globalConfigDefaults, ...legacyConfig }
  const configStore = new Configstore(null, defaults, { configPath })

  return configStore
}

const getGlobalConfig = async function () {
  const retries = 3
  // eslint-disable-next-line fp/no-loops
  for (let retry = 1; retry <= retries; retry++) {
    try {
      return await getGlobalConfigOnce()
    } catch (error) {
      if (retry === retries) {
        throw error
      }
    }
  }
}

// Memoise config result so that we only load it once
module.exports = memoizeOne(getGlobalConfig)
