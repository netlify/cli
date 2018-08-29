const Configstore = require('configstore')
const os = require('os')
const path = require('path')
const { toEnvCase, isDotProp } = require('./util')

const conf = new Configstore(
  null, // configPath overrides the namespace
  {
    // defaults
  },
  { configPath: path.join(os.homedir(), '.netlify', 'config.json') }
)

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

module.exports = configStore
