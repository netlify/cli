const AsciiTable = require('ascii-table')
const { flags } = require('@oclif/command')
const Command = require('../../base')
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

    const addons = await getAddons(siteId, accessToken)
    if (!addons || !addons.length) {
      this.log(`No addons currently installed for ${siteData.name}`)
      this.log(`> Run \`netlify addons:create addon-namespace\` to install an addon`)
      return false
    }

    // Json response for piping commands
    if (flags.json) {
      this.log(JSON.stringify(addons, null, 2))
      return false
    }

    const addonData = addons.map(addon => {
      // this.log('addon', addon)
      return {
        namespace: addon.service_path.replace('/.netlify/', ''),
        name: addon.service_name,
        id: addon.id
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

AddonsListCommand.description = `list current site add-ons
...
Add-ons are a way to extend the functionality of your Netlify site
`

AddonsListCommand.flags = {
  json: flags.boolean({
    description: 'Output add-on data as JSON'
  })
}
AddonsListCommand.hidden = true

module.exports = AddonsListCommand
