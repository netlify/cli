const Command = require('../../base')
const { getAddons } = require('netlify/src/addons')
const openBrowser = require('../../utils/open-browser')

class AddonsAuthCommand extends Command {
  async run() {
    const accessToken = await this.authenticate()
    const { args } = this.parse(AddonsAuthCommand)

    const addonName = args.name

    const siteId = this.netlify.site.id

    if (!siteId) {
      console.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }

    const site = await this.netlify.api.getSite({ siteId })
    const addons = await getAddons(siteId, accessToken)

    if (typeof addons === 'object' && addons.error) {
      console.log('API Error', addons)
      return false
    }

    // Filter down addons to current args.name
    const currentAddon = addons.find(addon => addon.service_path === `/.netlify/${addonName}`)

    if (!currentAddon || !currentAddon.id) {
      console.log(`Addon ${addonName} doesn't exist for ${site.name}`)
      return false
    }

    if (!currentAddon.auth_url) {
      console.log(`No Admin URL found for the "${addonName} add-on"`)
      return false
    }
    console.log()
    console.log(`Opening ${addonName} add-on admin URL:`)
    console.log()
    console.log(currentAddon.auth_url)
    console.log()
    await openBrowser(currentAddon.auth_url)
    this.exit()
  }
}
AddonsAuthCommand.aliases = ['addon:auth']
AddonsAuthCommand.args = [
  {
    name: 'name',
    required: true,
    description: 'Add-on slug'
  }
]

AddonsAuthCommand.description = `Login to add-on provider`

AddonsAuthCommand.hidden = true

module.exports = AddonsAuthCommand
