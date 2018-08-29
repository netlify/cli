const { Command } = require('@oclif/command')
const globalConfig = require('./global-config')
const SiteConfig = require('./site-config')
const openBrowser = require('../utils/open-browser')
const API = require('../utils/api')

// Netlify CLI client id
// Lives in bot@netlify.com
const CLIENT_ID = 'd6f37de6614df7ae58664cfca524744d73807a377f5ee71f1a254f78412e3750'

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
    const ticket = await client.createTicket({ clientId: CLIENT_ID })
    openBrowser(`https://app.netlify.com/authorize?response_type=ticket&ticket=${ticket.id}`)
    const accessToken = await client.getAccessToken(ticket)
    this.global.set('accessToken', accessToken)
    this.log('Logged in...')
  }
}

module.exports = BaseCommand
