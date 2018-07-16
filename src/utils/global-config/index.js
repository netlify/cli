const Configstore = require('configstore')
const os = require('os')
const path = require('path')
const snakeCase = require('lodash.snakecase')
const conf = new Configstore(
  null, // configPath overrides the namespace
  {
    clientId: '5edad8f69d47ae8923d0cf0b4ab95ba1415e67492b5af26ad97f4709160bb31b'
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

function isDotProp(key) {
  return key.includes('.') || key.includes('[')
}

function toEnvCase(key) {
  return `NETLIFY_${snakeCase(key).toUpperCase()}`
}

const configStore = new Proxy(conf, envProxy)

module.exports = configStore
module.exports.toEnvCase = toEnvCase
