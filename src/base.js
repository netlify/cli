const { Command } = require('@oclif/command')
const globalConfig = require('./utils/global-config')
const SiteConfig = require('./utils/site-config')
const API = require('./utils/api')
const openBrowser = require('./utils/open-browser')

class BaseCommand extends Command {
  constructor(...args) {
    super(...args)
    this.global = globalConfig
    this.site = new SiteConfig(process.cwd())
    this.netlify = new API(globalConfig.get('accessToken'))
  }

  async authenticate() {
    if (this.global.get('accessToken')) {
      return
    }
    this.log(`Logging into your Netlify account...`)
    const client = this.netlify
    const ticket = await client.api.createTicket(this.global.get('clientId'))
    openBrowser(`https://app.netlify.com/authorize?response_type=ticket&ticket=${ticket.id}`)
    const accessToken = await client.waitForAccessToken(ticket)
    this.global.set('accessToken', accessToken)
    this.log('Logged in...')
  }
}

module.exports = BaseCommand
