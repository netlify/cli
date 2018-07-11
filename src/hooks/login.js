const API = require('../utils/api')
const openBrowser = require('../utils/open-browser')

async function loginHook(opts) {
  if (this.globalConfig.get('accessToken')) {
    this.client = new API(this.globalConfig.get('accessToken'))
    return
  }
  this.log(`Logging into your Netlify account...`)
  const client = new API()
  const ticket = await client.api.createTicket(this.globalConfig.get('clientId'))
  openBrowser(`https://app.netlify.com/authorize?response_type=ticket&ticket=${ticket.id}`)
  const accessToken = await client.waitForAccessToken(ticket)
  this.globalConfig.get('accessToken', accessToken)
  this.client = client
  this.log('Logged in...')
}

module.exports = loginHook
