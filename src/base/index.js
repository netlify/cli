const { Command } = require('@oclif/command')
const chalk = require('chalk')
const globalConfig = require('./global-config')
const siteConfig = require('./site-config')
const State = require('./state')
const openBrowser = require('../utils/open-browser')
const projectRoot = require('./utils/projectRoot')
const { track, identify } = require('../utils/telemetry')
const API = require('../utils/api')

// Netlify CLI client id. Lives in bot@netlify.com
// Todo setup client for multiple environments
const CLIENT_ID = 'd6f37de6614df7ae58664cfca524744d73807a377f5ee71f1a254f78412e3750'

class BaseCommand extends Command {
  constructor(...args) {
    super(...args)

    // Get site id & build state
    const state = new State(projectRoot)

    // Pull in siteConfig from toml
    const siteConf = siteConfig(projectRoot, state)

    // Grab netlify API token
    const token = this.getAuthToken()

    this.netlify = {
      // api methods
      api: new API(token),
      // current site context
      site: siteConf,
      // global cli config
      globalConfig: globalConfig,
      // state of current site dir
      state: state,
    }
  }
  getAuthToken() {
    if (process.env.NETLIFY_AUTH_TOKEN) {
      return process.env.NETLIFY_AUTH_TOKEN
    }
    const userId = globalConfig.get('userId')
    return globalConfig.get(`users.${userId}.auth.token`)
  }
  async authenticate() {
    const token = this.getAuthToken()
    if (token) {
      return token
    }

    this.log(`Logging into your Netlify account...`)

    // Create ticket for auth
    const ticket = await this.netlify.api.createTicket({
      clientId: CLIENT_ID
    })

    // Open browser for authentication
    await openBrowser(`https://app.netlify.com/authorize?response_type=ticket&ticket=${ticket.id}`)

    const accessToken = await this.netlify.api.getAccessToken(ticket)

    if (accessToken) {
      const accounts = await this.netlify.api.listAccountsForUser()
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
      this.netlify.globalConfig.set('userId', userID)
      // Set user data
      this.netlify.globalConfig.set(`users.${userID}`, userData)

      identify({
        name: accountInfo.name || accountInfo.billing_name,
        email: accountInfo.billing_email,
      }).then(() => {
        track('cli:user_login')
      })

    }
    // Log success
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
