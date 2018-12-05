const Command = require('../base')
const { track } = require('../utils/telemetry')

class UnlinkCommand extends Command {
  async run() {
    const { site, state } = this.netlify
    const siteId = site.id

    if (!siteId) {
      this.log(`Folder is not linked to a Netlify site`)
      return this.exit()
    }

    let siteData = {}
    try {
      siteData = await this.netlify.api.getSite({ siteId })
    } catch (e) {
      // ignore errors if we can't get the site
    }

    state.delete('siteId')

    await track('sites_unlinked',  {
      siteId: siteData.id || siteId,
    })

    this.log(`Unlinked ${site.configPath} from ${siteData ? siteData.name : siteId}`)
  }
}

UnlinkCommand.description = `Unlink a local folder from a Netlify site`

module.exports = UnlinkCommand
