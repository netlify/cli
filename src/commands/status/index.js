const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const { CLIError } = require('@oclif/errors')

class StatusCommand extends Command {
  async run() {
    const accessToken = this.global.get('accessToken')
    const siteId = this.site.get('siteId')
    if (accessToken) {
      const accounts = await this.netlify.api.listAccountsForUser()
      const personal = accounts.find(account => account.type === 'PERSONAL')
      // TODO: make this better when we get the user endpoint
      this.log(`Logged in as ${personal.name} (${personal.billing_email})`)
    } else {
      this.log(`Error: Not logged in. Log in to see site status.`)
      this.exit()
    }

    if (siteId) {
      let site
      try {
        site = await this.netlify.api.getSite(siteId)
      } catch (e) {
        if (e.status === 401 /* unauthorized*/) {
          this.log(`Error: Not authorized to view the currently linked site (${siteId})`)
          this.log(`Log in with a different account or re-link to a site you have permission for`)
          this.exit()
        }
        throw new CLIError(e)
      }

      this.log(`Current project linked to ${site.name} (${site.ssl_url})`)
      this.log(`Config: ${this.site.path}`)
      this.log(`Admin URL: ${site.admin_url}`)
    } else {
      this.log(`You don't appear to be in a folder that is linked to a site`)
      this.log('Did you run `netlify link` yet?')
      this.exit()
    }
  }
}

StatusCommand.description = `${renderShortDesc('Print currently logged in use')}`

module.exports = StatusCommand
