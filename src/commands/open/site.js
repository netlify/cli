const Command = require('../../utils/command')
const { error, exit, log, warn } = require('../../utils/command-helpers')
const { openBrowser } = require('../../utils/open-browser')

class OpenAdminCommand extends Command {
  async run() {
    const { api, site } = this.netlify
    await this.authenticate()

    const siteId = site.id

    if (!siteId) {
      warn(`No Site ID found in current directory.
Run \`netlify link\` to connect to this folder to a site`)
      return false
    }

    let siteData
    let url
    try {
      siteData = await api.getSite({ siteId })
      url = siteData.ssl_url || siteData.url
      log(`Opening "${siteData.name}" site url:`)
      log(`> ${url}`)
    } catch (error_) {
      // unauthorized
      if (error_.status === 401) {
        warn(`Log in with a different account or re-link to a site you have permission for`)
        error(`Not authorized to view the currently linked site (${siteId})`)
      }
      error(error_)
    }

    await openBrowser({ url })
    exit()
  }
}

OpenAdminCommand.description = `Opens current site url in browser`

OpenAdminCommand.examples = ['netlify open:site']

module.exports = OpenAdminCommand
