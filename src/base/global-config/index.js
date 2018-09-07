const Configstore = require('configstore')
const os = require('os')
const path = require('path')
// const { toEnvCase, isDotProp } = require('./util')

const globalConfigDefaults = {
  /* disable stats from being sent to Netlify */
  telemetryDisabled: false
}

const globalConfigOptions = {
  configPath: path.join(os.homedir(), '.netlify', 'config.json')
}

module.exports = new Configstore(null, globalConfigDefaults, globalConfigOptions)

/* disable proxy
const envProxy = {}

envProxy.get = (cs, prop) => {
  if (prop === 'get') {
    return key => {
      if (isDotProp(key)) return cs.get(key)

      return process.env[toEnvCase(key)] || cs.get(key)
    }
  }

  return cs[prop]
}

const configStore = new Proxy(conf, envProxy)
*/
