const { Command } = require('@oclif/command')
const chalk = require('chalk')
const API = require('netlify')
const path = require('path')
const readConfig = require('./utils/read-config')
const globalConfig = require('./global-config')
const State = require('./state')
const openBrowser = require('../utils/open-browser')
const projectRoot = require('./utils/project-root')
const { track, identify } = require('../utils/telemetry')

// Netlify CLI client id. Lives in bot@netlify.com
// Todo setup client for multiple environments
const CLIENT_ID = 'd6f37de6614df7ae58664cfca524744d73807a377f5ee71f1a254f78412e3750'

class BaseCommand extends Command {
  constructor(...args) {
    super(...args)
  }
  // Initialize context
  async init(err) {
    // Grab netlify API token
    const token = this.configToken

    // Get site config from netlify.toml
    const configPath = path.join(projectRoot, 'netlify.toml')
    const config = readConfig(configPath)

    // Get site id & build state
    const state = new State(projectRoot)

    this.netlify = {
      // api methods
      api: new API(token),
      // current site context
      site: {
        id: state.get('siteId'),
        root: projectRoot
      },
      // Configuration from netlify.[toml/yml]
      config: config,
      // global cli config
      globalConfig: globalConfig,
      // state of current site dir
      state: state
    }
  }

  get clientToken () {
    return this.netlify.api.accessToken
  }

  set clientToken (token) {
    this.netlify.api.accessToken = token
  }

  get configToken() {
    const userId = globalConfig.get('userId')
    return globalConfig.get(`users.${userId}.auth.token`)
  }

  async isLoggedIn() {
    try {
      await this.netlify.api.getCurrentUser()
      return true
    } catch (_) {
      return false
    }
  }

  async authenticate(authToken) {
    const token = authToken || this.configToken
    if (token) {
      // Update the api client
      this.clientToken = token
      // Check if it works
      await this.netlify.api.getCurrentUser()
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

    if (!accessToken) this.error('Could not retrieve access token')

    const accountInfo = await this.netlify.api.getCurrentUser()
    const userID = accountInfo.id

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

    const email = accountInfo.billing_email
    await identify({
      name: accountInfo.name || accountInfo.billing_name,
      email: email
    }).then(() => {
      return track('user_login', {
        email: email
      })
    })
    // Log success
    this.log()
    this.log(`${chalk.greenBright('You are now logged into your Netlify account!')}`)
    this.log()
    this.log(`Run ${chalk.cyanBright('netlify status')} for account details`)
    this.log()
    this.log(`To see all available commands run: ${chalk.cyanBright('netlify help')}`)
    this.log()
    return accessToken
  }
}

module.exports = BaseCommand
