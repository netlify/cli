const Configstore = require('configstore')
const { v4: uuidv4 } = require('uuid')
const { getPathInHome } = require('../lib/settings')

const globalConfigDefaults = {
  /* disable stats from being sent to Netlify */
  telemetryDisabled: false,
  /* cliId */
  cliId: uuidv4(),
}

const globalConfigOptions = {
  configPath: getPathInHome(['config.json']),
}

module.exports = new Configstore(null, globalConfigDefaults, globalConfigOptions)
