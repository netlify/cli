const API = require('../utils/api')
const client = new API()
const config = require('../utils/config')
const openBrowser = require('../utils/open-browser')

async function loginHook(opts) {
  if (config.get('accessToken')) {
    return
  }
  this.log(`Logging into your Netlify account...`)
  const ticket = await client.api.createTicket(config.get('clientId'))
  openBrowser(`https://app.netlify.com/authorize?response_type=ticket&ticket=${ticket.id}`)
  const accessToken = await client.waitForAccessToken(ticket)
  config.set('accessToken', accessToken)
  this.log('Logged in...')
}

module.exports = loginHook
