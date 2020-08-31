const Configstore = require('configstore')
const os = require('os')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

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
