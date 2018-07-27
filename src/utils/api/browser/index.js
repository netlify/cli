const set = require('lodash.set')
const get = require('lodash.get')
const { methods } = require('./shape-swagger')
const dfn = require('@netlify/open-api')
const generateMethod = require('./generate-method')
const pWaitFor = require('p-wait-for')
const pTimeout = require('p-timeout')

// Browser compatible Open API Client
class NetlifyAPI {
  constructor(accessToken, opts) {
    if (typeof accessToken === 'object') {
      opts = accessToken
      accessToken = null
    }
    opts = Object.assign(
      {
        userAgent: 'netlify-js-client',
        scheme: dfn.schemes[0],
        host: dfn.host,
        pathPrefix: dfn.basePath
      },
      opts
    )
    this.defaultHeaders = {
      'User-agent': opts.userAgent,
      accept: 'application/json'
    }
    this.scheme = opts.scheme
    this.host = opts.host
    this.pathPrefix = opts.pathPrefix
    this.globalParams = Object.assign({}, opts.globalParams)
    if (accessToken) this.accessToken = accessToken
  }

  get accessToken() {
    return (get(this, 'defaultHeaders.Authorization') || '').replace('Bearer ', '')
  }

  set accessToken(token) {
    if (token) {
      set(this, 'defaultHeaders.Authorization', 'Bearer ' + token)
    } else {
      delete this.defaultHeaders.Authorization
    }
  }

  get basePath() {
    return `${this.scheme}://${this.host}${this.pathPrefix}`
  }

  // Attach generic browser compatible methods here
  async getAccessToken(ticket, opts) {
    opts = Object.assign(
      {
        poll: 1000,
        timeout: 3.6e6
      },
      opts
    )

    const { id } = ticket
    let authorizedTicket
    const api = this

    const checkTicket = async () => {
      const t = await api.showTicket({ ticketId: id })
      if (t.authorized) authorizedTicket = t
      return !!t.authorized
    }

    await pTimeout(pWaitFor(checkTicket, opts.poll), opts.timeout, 'Timeout while waiting for ticket grant')

    const accessToken = await api.exchangeTicket({ ticketId: authorizedTicket.id })
    this.accessToken = accessToken.access_token
    return accessToken.access_token
  }
}

methods.forEach(method => {
  /* {param1, param2, body, ... }, [opts] */
  NetlifyAPI.prototype[method.operationId] = generateMethod(method)
})

module.exports = NetlifyAPI
