const Command = require('../../base')
const { getAddons, deleteAddon } = require('netlify/src/addons')
// const parseRawFlags = require('../../utils/parseRawFlags')

class AddonsDeleteCommand extends Command {
  async run() {
    const accessToken = await this.authenticate()
    const { args } = this.parse(AddonsDeleteCommand)
    const { site } = this.netlify

    const addonName = args.name

    const siteId = site.id

    if (!siteId) {
      this.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }

    const addons = await getAddons(siteId, accessToken)

    if (typeof addons === 'object' && addons.error) {
      this.log('API Error', addons)
      return false
    }

    // Filter down addons to current args.name
    const currentAddon = addons.reduce((acc, current) => {
      if (current.service_path && current.service_path.replace('/.netlify/', '') === addonName) {
        return current
      }
      return {}
    }, addons)

    // If we need flags here
    // const rawFlags = parseRawFlags(raw)
    // this.log('rawFlags', rawFlags)

    if (!currentAddon.id) {
      this.log(`No add-on "${addonName}" found for site. Add-on already deleted or never existed!`)
      this.log(`> Run \`netlify addons:create ${addonName}\` to create an instance for this site`)
      return false
    }

    const settings = {
      siteId: siteId,
      addon: addonName,
      instanceId: currentAddon.id
    }
    const addonResponse = await deleteAddon(settings, accessToken)

    if (addonResponse.code === 404) {
      this.log(`No addon "${addonName}" found. Please double check your add-on name and try again`)
      return false
    }
    this.log(`Addon "${addonName}" deleted`)
  }
}

AddonsDeleteCommand.description = `Remove an add-on extension to your site
...
Add-ons are a way to extend the functionality of your Netlify site
`

// allow for any flags. Handy for variadic configuration options
AddonsDeleteCommand.strict = false
AddonsDeleteCommand.hidden = true

AddonsDeleteCommand.args = [
  {
    name: 'name',
    required: true,
    description: 'Add-on namespace'
  }
]

module.exports = AddonsDeleteCommand
