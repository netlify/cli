const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const prettyjson = require('prettyjson')
const get = require('lodash.get')
const chalk = require('chalk')
const clean = require('clean-deep')

class StatusCommand extends Command {
  async run() {
    const current = this.global.get('userId')
    const accessToken = this.global.get(`users.${current}.auth.token`)

    const siteId = this.site.get('siteId')

    this.log(`──────────────────────┐
 Current Netlify User │
──────────────────────┘`)
    let personal
    let accountData
    if (accessToken) {
      const accounts = await this.netlify.listAccountsForUser()
      personal = accounts.find(account => account.type === 'PERSONAL')
      const teams = accounts.filter(account => account.type !== 'PERSONAL')
      const ghuser = this.global.get(`users.${current}.auth.github.user`)
      accountData = {
        'Account name': get(personal, 'name'),
        // 'Account slug': get(personal, 'slug'),
        // 'Account id': get(personal, 'id'),
        // Name: get(personal, 'billing_name'),
        Email: get(personal, 'billing_email'),
        Github: ghuser
      }
      const teamsData = {}

      teams.forEach(team => {
        return (teamsData[team.name] = team.roles_allowed.join(' '))
      })

      accountData.Teams = teamsData
      // TODO: use users endpoint
    } else {
      this.error(`Not logged in. Log in to see site status.`)
    }

    this.log(prettyjson.render(clean(accountData)))

    this.log(`────────────────────┐
 Netlify Site Info  │
────────────────────┘`)

    if (!siteId) {
      this.warn('Did you run `netlify link` yet?')
      this.error(`You don't appear to be in a folder that is linked to a site`)
    }
    let site
    try {
      site = await this.netlify.getSite({ siteId })
    } catch (e) {
      if (e.status === 401 /* unauthorized*/) {
        this.warn(`Log in with a different account or re-link to a site you have permission for`)
        this.error(`Not authorized to view the currently linked site (${siteId})`)
      }
      if (e.status === 404 /* missing */) {
        this.error(`The site this folder is linked to can't be found`)
      }
      this.error(e)
    }

    const statusData = {
      'Current site': `${site.name}`,
      'Netlify TOML': this.site.tomlPath,
      'Admin URL': chalk.magentaBright(site.admin_url),
      'Site URL': chalk.cyanBright(site.ssl_url || site.url)
    }

    this.log(prettyjson.render(statusData))
  }
}

StatusCommand.description = `${renderShortDesc('Print status information')}`

module.exports = StatusCommand
