const NetlifysApiDefinition = require('netlifys_api_definition')
const promisifyAll = require('util.promisify-all')
const deploy = require('./deploy')
const getAccessToken = require('access-token')

class Netlify {
  constructor(accessToken) {
    if (accessToken) {
      const defaultClient = NetlifysApiDefinition.ApiClient.instance
      const netlifyAuth = defaultClient.authentications['netlifyAuth']
      netlifyAuth.accessToken = accessToken
    }
    this.accessToken = accessToken
    this.api = promisifyAll(new NetlifysApiDefinition.DefaultApi())
  }

  async deploy(siteId, buildDir, opts) {
    if (!this.accessToken) throw new Error('Missing access token')
    return await deploy(this.api, siteId, buildDir, opts)
  }

  async waitForAccessToken(ticket) {
    const accessToken = await getAccessToken(this.api, ticket)

    // Update the API client with the access token
    this.api.apiClient.authentications.netlifyAuth.accessToken = accessToken
    this.accessToken = accessToken

    return accessToken
  }
}

module.exports = Netlify
