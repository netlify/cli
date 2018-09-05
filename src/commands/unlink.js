const Command = require('../base')
const renderShortDesc = require('../utils/renderShortDescription')

class UnlinkCommand extends Command {
  async run() {
    const siteId = this.site.get('siteId')

    if (!siteId) {
      this.log(`Folder is not linked to a Netlify site`)
      return this.exit()
    }

    let site
    try {
      site = await this.netlify.getSite({ siteId })
    } catch (e) {
      // ignore errors if we can't get the site
    }

    this.site.delete('siteId')

    this.log(
      `Unlinked ${this.site.path} from ${site ? site.name : siteId}`
    )
  }
}

UnlinkCommand.description = `${renderShortDesc('Unlink a local folder from a Netlify site')}`

module.exports = UnlinkCommand
