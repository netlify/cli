const deploy = require('./deploy')
const NetlifyAPI = require('./browser')

class NetlifyNodeAPI extends NetlifyAPI {
  // Attach node specific methods to this class
  async deploy(siteId, buildDir, opts) {
    if (!this.accessToken) throw new Error('Missing access token')
    return await deploy(this, siteId, buildDir, opts)
  }
}

module.exports = NetlifyNodeAPI
