const NetlifysApiDefinition = require('netlifys_api_definition')
const promisify = require('util.promisify-all')
const deploy = require('./deploy')

class Netlify {
  constructor(accessToken) {
    if (accessToken) {
      const defaultClient = NetlifysApiDefinition.ApiClient.instance
      const netlifyAuth = defaultClient.authentications['netlifyAuth']
      netlifyAuth.accessToken = accessToken
    }
    this.accessToken = accessToken
    this.api = promisify(new NetlifysApiDefinition.DefaultApi())
  }

  async deploy(siteId, buildDir, opts) {
    if (!this.accessToken) throw new Error('Missing access token')
    await deploy(this.api, buildDir, opts)
  }

  async waitForAccessToken(ticket) {
    const ts = new Date()
    ts.setHours(ts.getHours() + 1)

    const waitForAuthorizedTicket = (ticket, waitUntil) => {
      if (waitUntil && new Date() > waitUntil) {
        return Promise.reject(new Error('Timeout while waiting for ticket grant'))
      }

      if (ticket.authorized) {
        return Promise.resolve(ticket)
      }

      const wait = new Promise(resolve => {
        setTimeout(() => resolve(ticket), 500)
      })
        .then(ticket => this.api.showTicket(ticket.id))
        .then(ticket => waitForAuthorizedTicket(ticket, waitUntil))

      return wait
    }

    const authorizedTicket = await waitForAuthorizedTicket(ticket, ts)
    const accessToken = await this.api.exchangeTicket(authorizedTicket.id)

    // Update the API client with the access token
    this.api.apiClient.authentications.netlifyAuth.accessToken = accessToken.access_token
    this.accessToken = accessToken.access_token
    return accessToken.access_token
  }
}

module.exports = Netlify
