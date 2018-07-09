const NetlifysApiDefinition = require('netlifys_api_definition')
const promisifyAll = require('util.promisify-all')
const deploy = require('./deploy')
const pWaitFor = require('p-wait-for')
const pTimeout = require('p-timeout')

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
    const { id } = ticket

    let authorizedTicket
    await pTimeout(
      pWaitFor(async () => {
        const t = await this.api.showTicket(id)
        if (t.authorized) authorizedTicket = t
        return !!t.authorized
      }, 1000), // poll every 1 second
      3.6e6, // timeout after 1 hour
      'Timeout while waiting for ticket grant'
    )

    const accessToken = await this.api.exchangeTicket(authorizedTicket.id)

    // Update the API client with the access token
    this.api.apiClient.authentications.netlifyAuth.accessToken = accessToken.access_token
    this.accessToken = accessToken.access_token
    return accessToken.access_token
  }
}

module.exports = Netlify
