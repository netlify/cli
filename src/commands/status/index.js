const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const prettyjson = require('prettyjson')
const get = require('lodash.get')
const clean = require('clean-deep')

class StatusCommand extends Command {
  async run() {
    const accessToken = this.global.get('accessToken')
    const siteId = this.site.get('siteId')

    let personal
    let accountData
    if (accessToken) {
      const accounts = await this.netlify.listAccountsForUser()
      personal = accounts.find(account => account.type === 'PERSONAL')
      const teams = accounts.filter(account => account.type !== 'PERSONAL')
      accountData = {
        'Account name': get(personal, 'name'),
        'Account slug': get(personal, 'slug'),
        'Account id': get(personal, 'id'),
        Name: get(personal, 'billing_name'),
        Email: get(personal, 'billing_email')
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
      this.error(e)
    }

    const statusData = {
      'Current project': `${site.name} (${site.ssl_url})`,
      'CLI Cache': this.site.path,
      'Netlify TOML': this.site.tomlPath,
      'Admin URL': site.admin_url,
      CWD: process.cwd()
    }
    this.log(`──────────────────────┐
 Current Netlify User │
──────────────────────┘`)
    this.log(prettyjson.render(clean(accountData)))
    this.log(`────────────────────┐
 Netlify Site Info  │
────────────────────┘`)

    this.log(prettyjson.render(statusData))

  }
}

StatusCommand.description = `${renderShortDesc('Print currently logged in use')}`

module.exports = StatusCommand
