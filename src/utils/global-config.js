const Configstore = require('configstore')
const os = require('os')
const path = require('path')
const uuidv4 = require('uuid/v4')

const globalConfigDefaults = {
  /* disable stats from being sent to Netlify */
  telemetryDisabled: false,
  /* cliId */
  cliId: uuidv4(),
}

const globalConfigOptions = {
  configPath: path.join(os.homedir(), '.netlify', 'config.json'),
}

module.exports = new Configstore(null, globalConfigDefaults, globalConfigOptions)
