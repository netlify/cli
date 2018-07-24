const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const { CLIError } = require('@oclif/errors')
const prettyjson = require('prettyjson')

class StatusCommand extends Command {
  async run() {
    const accessToken = this.global.get('accessToken')
    const siteId = this.site.get('siteId')
    let personal
    if (accessToken) {
      const accounts = await this.netlify.api.listAccountsForUser()
      personal = accounts.find(account => account.type === 'PERSONAL')
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
      site = await this.netlify.api.getSite(siteId)
    } catch (e) {
      if (e.status === 401 /* unauthorized*/) {
        this.warn(`Log in with a different account or re-link to a site you have permission for`)
        this.error(`Not authorized to view the currently linked site (${siteId})`)
      }
      throw new CLIError(e)
    }

    const statusData = {
      'Logged in as': `${personal.name} (${personal.billing_email})`,
      'Current project': `${site.name} (${site.ssl_url})`,
      'CLI Cache': this.site.path,
      'Netlify TOML': this.site.tomlPath,
      'Admin URL': site.admin_url,
      CWD: process.cwd()
    }
    this.log(prettyjson.render(statusData))
  }
}

StatusCommand.description = `${renderShortDesc('Print currently logged in use')}`

module.exports = StatusCommand
