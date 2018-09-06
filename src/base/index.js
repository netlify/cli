const { Command } = require('@oclif/command')
const chalk = require('chalk')
const globalConfig = require('./global-config')
const SiteConfig = require('./site-config')
const openBrowser = require('../utils/open-browser')
const API = require('../utils/api')

// Netlify CLI client id. Lives in bot@netlify.com
// Todo setup client for multiple environments
const CLIENT_ID = 'd6f37de6614df7ae58664cfca524744d73807a377f5ee71f1a254f78412e3750'

class BaseCommand extends Command {
  constructor(...args) {
    super(...args)
    this.global = globalConfig
    this.site = new SiteConfig(process.cwd())
    const currentUser = globalConfig.get('userId')
    const token = globalConfig.get(`users.${currentUser}.auth.token`)
    this.netlify = new API(token)
  }

  async authenticate() {
    const currentUser = this.global.get('userId')
    const token = this.global.get(`users.${currentUser}.auth.token`)
    if (token) {
      return token
    }

    this.log(`Logging into your Netlify account...`)

    // Create ticket for auth
    const ticket = await this.netlify.createTicket({
      clientId: CLIENT_ID
    })

    // Open browser for authentication
    await openBrowser(`https://app.netlify.com/authorize?response_type=ticket&ticket=${ticket.id}`)

    const accessToken = await this.netlify.getAccessToken(ticket)

    if (accessToken) {
      const accounts = await this.netlify.listAccountsForUser()
      const accountInfo = accounts.find(account => account.type === 'PERSONAL')
      const userID = accountInfo.owner_ids[0]

      const userData = {
        id: userID,
        name: accountInfo.name || accountInfo.billing_name,
        email: accountInfo.billing_email,
        slug: accountInfo.slug,
        auth: {
          token: accessToken,
          github: {
            user: null,
            token: null
          }
        }
      }
      // Set current userId
      this.global.set('userId', userID)
      // Set user data
      this.global.set(`users.${userID}`, userData)

    }
    this.log()
    this.log(`${chalk.greenBright('You are now logged into your Netlify account!')}`)
    this.log()
    this.log(`Run ${chalk.cyanBright('netlify status')} for account details`)
    this.log()
    this.log(`To see all available commands run: ${chalk.cyanBright('netlify help')}`)
    this.log()

  }
}

module.exports = BaseCommand
