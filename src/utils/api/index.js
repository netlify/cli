const NetlifysApiDefinition = require('netlifys_api_definition')
const promisifyAll = require('util.promisify-all')
const deploy = require('./deploy')
const getAccessToken = require('./access-token')
const get = require('lodash.get')
const set = require('lodash.set')

class Netlify {
  constructor(accessToken) {
    if (accessToken) {
      const defaultClient = NetlifysApiDefinition.ApiClient.instance
      const netlifyAuth = defaultClient.authentications['netlifyAuth']
      netlifyAuth.accessToken = accessToken
    }
    this.api = promisifyAll(new NetlifysApiDefinition.DefaultApi())
  }

  get accessToken() {
    get(this.api, 'apiClient.authentications.netlifyAuth.accessToken')
  }

  set accessToken(token) {
    set(this.api, 'apiClient.authentications.netlifyAuth.accessToken', token)
  }

  async deploy(siteId, buildDir, opts) {
    if (!this.accessToken) throw new Error('Missing access token')
    return await deploy(this.api, siteId, buildDir, opts)
  }

  async waitForAccessToken(ticket) {
    this.accessToken = await getAccessToken(this.api, ticket)
    return this.accessToken
  }
}

module.exports = Netlify
