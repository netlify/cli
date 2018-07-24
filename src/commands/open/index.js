const Command = require('../../base')
const openBrowser = require('../../utils/open-browser')
const renderShortDesc = require('../../utils/renderShortDescription')

class OpenCommand extends Command {
  async run() {
    this.log(`Opening {SITE XYZ} admin in your default browser`)
    const accessToken = this.global.get('accessToken')
    const siteId = this.site.get('siteId')
    if (!accessToken) {
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
      this.error(e)
    }

    openBrowser(site.admin_url)
    this.exit()
  }
}

OpenCommand.description = `${renderShortDesc('Opens current site admin UI in netlify')}`

OpenCommand.examples = ['$ netlify open']

OpenCommand.hidden = true

module.exports = OpenCommand
