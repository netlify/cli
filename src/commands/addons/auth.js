const { getAddons } = require('netlify/src/addons')
const Command = require('../../utils/command')
const openBrowser = require('../../utils/open-browser')

class AddonsAuthCommand extends Command {
  async run() {
    let accessToken = await this.authenticate()
    const { args } = this.parse(AddonsAuthCommand)

    const addonName = args.name

    const siteId = this.netlify.site.id

    if (!siteId) {
      this.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }

    const site = await this.netlify.api.getSite({ siteId })
    const addons = await getAddons(siteId, accessToken)

    if (typeof addons === 'object' && addons.error) {
      this.log('API Error', addons)
      return false
    }

    // Filter down addons to current args.name
    const currentAddon = addons.find(addon => addon.service_path === `/.netlify/${addonName}`)

    if (!currentAddon || !currentAddon.id) {
      this.log(`Addon ${addonName} doesn't exist for ${site.name}`)
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
    await openBrowser(currentAddon.auth_url)
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
