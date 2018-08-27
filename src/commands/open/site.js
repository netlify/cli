const Command = require('../../base')
const openBrowser = require('../../utils/open-browser')
const renderShortDesc = require('../../utils/renderShortDescription')

class OpenAdminCommand extends Command {
  async run() {
    const accessToken = this.global.get('accessToken')
    const siteId = this.site.get('siteId')
    if (!accessToken) {
      this.error(`Not logged in.`)
    }

    if (!siteId) {
      this.warn(`No Site ID found in current directory.
Run \`netlify link\` to connect to this folder to a site`)
      return false
    }

    let site
    let url
    try {
      site = await this.netlify.getSite({ siteId })
      url = site.ssl_url || site.url
      this.log(`Opening "${site.name}" site url:`)
      this.log(`> ${url}`)
    } catch (e) {
      if (e.status === 401 /* unauthorized*/) {
        this.warn(`Log in with a different account or re-link to a site you have permission for`)
        this.error(`Not authorized to view the currently linked site (${siteId})`)
      }
      this.error(e)
    }

    openBrowser(url)
    this.exit()
  }
}

OpenAdminCommand.description = `${renderShortDesc('Opens current site url in browser')}`

OpenAdminCommand.examples = ['$ netlify open:site']

module.exports = OpenAdminCommand
