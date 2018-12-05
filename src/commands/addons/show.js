const Command = require('../../base')
const { getAddons } = require('netlify/src/addons')

class AddonsShowCommand extends Command {
  async run() {
    const accessToken = await this.authenticate()
    const { args } = this.parse(AddonsShowCommand)

    const addonName = args.name

    const siteId = this.netlify.site.id

    if (!siteId) {
      console.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }

    const site = await this.netlify.api.getSite({ siteId })
    // console.log(site)
    const addons = await getAddons(siteId, accessToken)

    if (typeof addons === 'object' && addons.error) {
      console.log('API Error', addons)
      return false
    }

    // Filter down addons to current args.name
    const currentAddon = addons.reduce((acc, current) => {
      if (current.service_path && current.service_path.replace('/.netlify/', '') === addonName) {
        return current
      }
      return {}
    }, addons)

    if (!currentAddon || !currentAddon.id) {
      console.log(`Addon ${addonName} doesnt exist for ${site.name}`)
      console.log(`> Run \`netlify addons:create ${addonName}\` to create an instance for this site`)
      return false
    }

    // Get Existing Config
    const currentConfig = currentAddon.config.config || {}

    console.dir(currentConfig, {
      colors: true,
      depth: Infinity
    })
  }
}

AddonsShowCommand.args = [
  {
    name: 'name',
    required: true,
    description: 'addon namespace'
  }
]

AddonsShowCommand.description = `Print raw configuration for a given namespace
...
Use this command to get an idea of how your addon is configured, and available configuration options.
`

AddonsShowCommand.hidden = true

module.exports = AddonsShowCommand
