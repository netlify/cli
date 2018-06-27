const Configstore = require('configstore')
const os = require('os')
const path = require('path')
const conf = new Configstore(
  null,
  {
    clientId: '5edad8f69d47ae8923d0cf0b4ab95ba1415e67492b5af26ad97f4709160bb31b'
  },
  { configPath: path.join(os.homedir(), '.netlify', 'config.json') }
)

module.exports = conf
