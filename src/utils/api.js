const NetlifysApiDefinition = require('netlifys_api_definition')
const promisify = require('util.promisify-all')

class Netlify {
  constructor(accessToken) {
    if (accessToken) {
      const defaultClient = NetlifysApiDefinition.ApiClient.instance
      const netlifyAuth = defaultClient.authentications['netlifyAuth']
      netlifyAuth.accessToken = accessToken
    }

    this.api = promisify(new NetlifysApiDefinition.DefaultApi())
  }

  async waitForAccessToken(ticket) {
    const ts = new Date()
    ts.setHours(ts.getHours() + 1)

    const waitForAuthorizedToken = (ticket, waitUntil) => {
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
        .then(ticket => waitForAuthorizedToken(ticket, waitUntil))
  
      return wait
    }

    const authorizedTicket = await waitForAuthorizedToken(ticket, ts)
    const accessToken = await this.api.exchangeTicket(authorizedTicket.id)

    return accessToken.access_token
  }
}

module.exports = Netlify
