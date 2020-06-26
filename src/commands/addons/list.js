const AsciiTable = require('ascii-table')
const { flags } = require('@oclif/command')
const Command = require('../../utils/command')
const { getAddons } = require('netlify/src/addons')

class AddonsListCommand extends Command {
  async run() {
    const { flags } = this.parse(AddonsListCommand)
    const { api, site } = this.netlify
    const accessToken = await this.authenticate()
    const siteId = site.id

    if (!siteId) {
      this.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }

    const siteData = await api.getSite({ siteId })

    // TODO update getAddons to https://open-api.netlify.com/#operation/getServices
    const addons = await getAddons(siteId, accessToken)

    // Return json response for piping commands
    if (flags.json) {
      this.logJson(addons)
      return false
    }

    if (!addons || !addons.length) {
      this.log(`No addons currently installed for ${siteData.name}`)
      this.log(`> Run \`netlify addons:create addon-namespace\` to install an addon`)
      return false
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'addons:list',
      },
    })

    const addonData = addons.map(addon => {
      return {
        namespace: addon.service_path.replace('/.netlify/', ''),
        name: addon.service_name,
        id: addon.id,
      }
    })

    // Build a table out of addons
    this.log(`site: ${siteData.name}`)
    const table = new AsciiTable(`Currently Installed addons`)

    table.setHeading('NameSpace', 'Name', 'Instance Id')

    addonData.forEach(s => {
      table.addRow(s.namespace, s.name, s.id)
    })
    // Log da addons
    this.log(table.toString())
  }
}

AddonsListCommand.description = `List currently installed add-ons for site`
AddonsListCommand.aliases = ['addon:list']
AddonsListCommand.flags = {
  ...AddonsListCommand.flags,
  json: flags.boolean({
    description: 'Output add-on data as JSON',
  }),
}

module.exports = AddonsListCommand
