const Command = require('../../base')
const { getAddons, deleteAddon } = require('netlify/src/addons')
// const parseRawFlags = require('../../utils/parseRawFlags')

class addonsDeleteCommand extends Command {
  async run() {
    const accessToken = await this.authenticate()
    const { args } = this.parse(addonsDeleteCommand)
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
      this.log(`No addon "${addonName}" found for site. Addon already deleted or never existed!`)
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
      this.log(`No addon "${addonName}" found. Please double check your addon name and try again`)
      return false
    }
    this.log(`Addon "${addonName}" deleted`)
  }
}

addonsDeleteCommand.description = `Remove an addon extension to your site
...
Addons are a way to extend the functionality of your Netlify site
`

// allow for any flags. Handy for variadic configuration options
addonsDeleteCommand.strict = false

addonsDeleteCommand.args = [
  {
    name: 'name',
    required: true,
    description: 'addon namespace'
  }
]

addonsDeleteCommand.hidden = true

module.exports = addonsDeleteCommand
