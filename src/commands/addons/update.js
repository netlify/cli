const mergewith = require('lodash.mergewith')
const Command = require('../../base')
const { getAddons, updateAddon } = require('netlify/src/addons')
const parseRawFlags = require('../../utils/parseRawFlags')

class addonsUpdateCommand extends Command {
  async run() {
    const accessToken = await this.authenticate()
    const { args, raw } = this.parse(addonsUpdateCommand)

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

    // Parse flags
    const rawFlags = parseRawFlags(raw)

    // TODO diff rawFlags and currentConfig and dont make API call if equal

    // Merge current config with new values passed in
    const newConfigValue = mergewith(currentConfig, rawFlags)

    const settings = {
      siteId: siteId,
      instanceId: currentAddon.id,
      addon: addonName,
      config: newConfigValue
    }

    const updateAddonResponse = await updateAddon(settings, accessToken)
    // console.log('addonResponse', updateAddonResponse)

    if (updateAddonResponse.code === 404) {
      console.log(`No addon "${addonName}" found. Please double check your addon name and try again`)
      return false
    }
    this.log(`Addon "${addonName}" updated`)
  }
}

addonsUpdateCommand.description = `Update an addon extension
...
Addons are a way to extend the functionality of your Netlify site
`

addonsUpdateCommand.args = [
  {
    name: 'name',
    required: true,
    description: 'addon namespace'
  }
]

addonsUpdateCommand.hidden = true

// allow for any flags. Handy for variadic configuration options
addonsUpdateCommand.strict = false

module.exports = addonsUpdateCommand
