const set = require('lodash.set')
const get = require('lodash.get')
const dfn = require('@netlify/open-api')
const { methods, generateMethod } = require('./open-api')
const pWaitFor = require('p-wait-for')
const deploy = require('./deploy')

class NetlifyAPI {
  constructor(accessToken, opts) {
    if (typeof accessToken === 'object') {
      opts = accessToken
      accessToken = null
    }
    opts = Object.assign(
      {
        userAgent: '@netlify/js-client',
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

    await pWaitFor(checkTicket, {
      interval: opts.poll,
      timeout: opts.timeout,
      message: 'Timeout while waiting for ticket grant'
    })

    const accessToken = await api.exchangeTicket({ ticketId: authorizedTicket.id })
    this.accessToken = accessToken.access_token
    return accessToken.access_token
  }

  async deploy(siteId, buildDir, functionsDir, tomlPath, opts) {
    if (!this.accessToken) throw new Error('Missing access token')
    return await deploy(this, siteId, buildDir, functionsDir, tomlPath, opts)
  }
}

methods.forEach(method => {
  /* {param1, param2, body, ... }, [opts] */
  NetlifyAPI.prototype[method.operationId] = generateMethod(method)
})

module.exports = NetlifyAPI
