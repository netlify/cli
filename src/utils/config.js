const Configstore = require('configstore')
const os = require('os')
const path = require('path')
const snakeCase = require('lodash.snakecase')
const conf = new Configstore(
  null,
  {
    clientId: '5edad8f69d47ae8923d0cf0b4ab95ba1415e67492b5af26ad97f4709160bb31b'
  },
  { configPath: path.join(os.homedir(), '.netlify', 'config.json') }
)

const envProxy = {
  get: (cs, prop) => {
    if (prop === 'get') {
      return key => {
        if (key.includes('.') || key.includes('[')) return cs.get(key) // dot-prop notation

        return process.env[toEnvCase(key)] || cs.get(key)
      }
    }

    return cs[prop]
  }
}

function toEnvCase(key) {
  return `NETLIFY_${snakeCase(key).toUpperCase()}`
}

module.exports = new Proxy(conf, envProxy)
