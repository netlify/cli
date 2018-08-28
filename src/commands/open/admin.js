const Command = require('../../base')
const openBrowser = require('../../utils/open-browser')
const renderShortDesc = require('../../utils/renderShortDescription')

class OpenAdminCommand extends Command {
  async run() {
    const accessToken = this.global.get('accessToken')
    const siteId = this.site.get('siteId')
    if (!accessToken) {
      this.error(`Not logged in. Log in to see site status.`)
    }

    if (!siteId) {
      this.warn(`No Site ID found in current directory.
Run \`netlify link\` to connect to this folder to a site`)
      return false
    }

    let site
    try {
      site = await this.netlify.getSite({ siteId })
      this.log(`Opening "${site.name}" site admin UI:`)
      this.log(`> ${site.admin_url}`)
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

OpenAdminCommand.description = `${renderShortDesc('Opens current site admin UI in Netlify')}`

OpenAdminCommand.examples = ['$ netlify open:admin']

module.exports = OpenAdminCommand
