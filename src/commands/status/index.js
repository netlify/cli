const { flags: flagsLib } = require('@oclif/command')
const chalk = require('chalk')
const clean = require('clean-deep')
const prettyjson = require('prettyjson')

const Command = require('../../utils/command')
const { error, exit, getToken, log, logJson, warn } = require('../../utils/command-helpers')

class StatusCommand extends Command {
  async run() {
    const { api, globalConfig, site } = this.netlify
    const { flags } = this.parse(StatusCommand)

    const current = globalConfig.get('userId')
    const [accessToken] = await getToken()

    if (!accessToken) {
      log(`Not logged in. Please log in to see site status.`)
      log()
      log('Login with "netlify login" command')
      exit()
    }

    const siteId = site.id

    log(`──────────────────────┐
 Current Netlify User │
──────────────────────┘`)

    let accounts
    let user

    try {
      ;[accounts, user] = await Promise.all([api.listAccountsForUser(), api.getCurrentUser()])
    } catch (error_) {
      if (error_.status === 401) {
        error(
          'Your session has expired. Please try to re-authenticate by running `netlify logout` and `netlify login`.',
        )
      }
    }

    const ghuser = this.netlify.globalConfig.get(`users.${current}.auth.github.user`)
    const accountData = {
      Name: user.full_name,
      Email: user.email,
      GitHub: ghuser,
    }
    const teamsData = {}

    accounts.forEach((team) => {
      teamsData[team.name] = team.roles_allowed.join(' ')
    })

    accountData.Teams = teamsData

    const cleanAccountData = clean(accountData)

    log(prettyjson.render(cleanAccountData))

    if (!siteId) {
      warn('Did you run `netlify link` yet?')
      error(`You don't appear to be in a folder that is linked to a site`)
    }
    let siteData
    try {
      siteData = await api.getSite({ siteId })
    } catch (error_) {
      // unauthorized
      if (error_.status === 401) {
        warn(`Log in with a different account or re-link to a site you have permission for`)
        error(`Not authorized to view the currently linked site (${siteId})`)
      }
      // missing
      if (error_.status === 404) {
        error(`The site this folder is linked to can't be found`)
      }
      error(error_)
    }

    // Json only logs out if --json flag is passed
    if (flags.json) {
      logJson({
        account: cleanAccountData,
        siteData: {
          'site-name': `${siteData.name}`,
          'config-path': site.configPath,
          'admin-url': siteData.admin_url,
          'site-url': siteData.ssl_url || siteData.url,
          'site-id': siteData.id,
        },
      })
    }

    log(`────────────────────┐
 Netlify Site Info  │
────────────────────┘`)
    log(
      prettyjson.render({
        'Current site': `${siteData.name}`,
        'Netlify TOML': site.configPath,
        'Admin URL': chalk.magentaBright(siteData.admin_url),
        'Site URL': chalk.cyanBright(siteData.ssl_url || siteData.url),
        'Site Id': chalk.yellowBright(siteData.id),
      }),
    )
    log()
  }
}

StatusCommand.description = `Print status information`

StatusCommand.flags = {
  verbose: flagsLib.boolean({
    description: 'Output system info',
  }),
  ...StatusCommand.flags,
}

module.exports = StatusCommand
