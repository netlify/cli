const Command = require('../../utils/command')
const openBrowser = require('../../utils/open-browser')

class OpenAdminCommand extends Command {
  async run() {
    const { api, site } = this.netlify
    await this.authenticate()

    const siteId = site.id

    if (!siteId) {
      this.warn(`No Site ID found in current directory.
Run \`netlify link\` to connect to this folder to a site`)
      return false
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'open:admin'
      }
    })

    let siteData
    try {
      siteData = await api.getSite({ siteId })
      this.log(`Opening "${siteData.name}" site admin UI:`)
      this.log(`> ${siteData.admin_url}`)
    } catch (e) {
      if (e.status === 401 /* unauthorized*/) {
        this.warn(`Log in with a different account or re-link to a site you have permission for`)
        this.error(`Not authorized to view the currently linked site (${siteId})`)
      }
      if (e.status === 404 /* site not found */) {
        this.log()
        this.log('Please double check this ID and verify you are logged in with the correct account')
        this.log()
        this.log('To fix this, run `netlify unlink` then `netlify link` to reconnect to the correct site ID')
        this.log()
        this.error(`Site "${siteId}" not found in account`)
      }
      this.error(e)
    }

    await openBrowser(siteData.admin_url)
    this.exit()
  }
}

OpenAdminCommand.description = `Opens current site admin UI in Netlify`

OpenAdminCommand.examples = ['netlify open:admin']

module.exports = OpenAdminCommand
