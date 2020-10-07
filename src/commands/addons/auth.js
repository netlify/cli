const { getAddons } = require('../../lib/api')
const Command = require('../../utils/command')
const openBrowser = require('../../utils/open-browser')

class AddonsAuthCommand extends Command {
  async run() {
    const { args } = this.parse(AddonsAuthCommand)
    const addonName = args.name

    await this.authenticate()
    const { api, site } = this.netlify
    const siteId = site.id

    if (!siteId) {
      this.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }

    let addons
    try {
      addons = await getAddons({ api, siteId })
    } catch (error) {
      this.log(`API Error: ${error.message}`)
      return false
    }

    // Filter down addons to current args.name
    const currentAddon = addons.find(addon => addon.service_path === `/.netlify/${addonName}`)

    const siteData = await this.netlify.api.getSite({ siteId })
    if (!currentAddon || !currentAddon.id) {
      this.log(`Addon ${addonName} doesn't exist for ${siteData.name}`)
      return false
    }

    if (!currentAddon.auth_url) {
      console.log(`No Admin URL found for the "${addonName} add-on"`)
      return false
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'addons:auth',
      },
    })

    this.log()
    this.log(`Opening ${addonName} add-on admin URL:`)
    this.log()
    this.log(currentAddon.auth_url)
    this.log()
    await openBrowser({ url: currentAddon.auth_url, log: this.log })
    this.exit()
  }
}
AddonsAuthCommand.aliases = ['addon:auth']
AddonsAuthCommand.args = [
  {
    name: 'name',
    required: true,
    description: 'Add-on slug',
  },
]

AddonsAuthCommand.description = `Login to add-on provider`

module.exports = AddonsAuthCommand
