const fs = require('fs')

const Configstore = require('configstore')
const { v4: uuidv4 } = require('uuid')

const { getPathInHome } = require('../lib/settings')

const CONFIG_NAME = 'netlify'

const globalConfigDefaults = {
  /* disable stats from being sent to Netlify */
  telemetryDisabled: false,
  /* cliId */
  cliId: uuidv4(),
}

const legacyConfigPath = getPathInHome(['config.json'])
const legacyConfigExists = fs.existsSync(legacyConfigPath)

// Configuration location can be:
// - ~/.netlify/config
// - $XDG_CONFIG_HOME/netlify/config.json
// - ~/.config/netlify/config.json
const globalConfigOptions = {
  configPath: legacyConfigExists ? legacyConfigPath : undefined,
  globalConfigPath: true,
}

module.exports = new Configstore(CONFIG_NAME, globalConfigDefaults, globalConfigOptions)
