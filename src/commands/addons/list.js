const { flags: flagsLib } = require('@oclif/command')
const AsciiTable = require('ascii-table')

const { prepareAddonCommand } = require('../../utils/addons/prepare')
const Command = require('../../utils/command')

class AddonsListCommand extends Command {
  async run() {
    const { flags } = this.parse(AddonsListCommand)

    const { addons, siteData } = await prepareAddonCommand({ context: this })

    // Return json response for piping commands
    if (flags.json) {
      this.logJson(addons)
      return false
    }

    if (!addons || addons.length === 0) {
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

    const addonData = addons.map((addon) => ({
      namespace: addon.service_path.replace('/.netlify/', ''),
      name: addon.service_name,
      id: addon.id,
    }))

    // Build a table out of addons
    this.log(`site: ${siteData.name}`)
    const table = new AsciiTable(`Currently Installed addons`)

    table.setHeading('NameSpace', 'Name', 'Instance Id')

    addonData.forEach(({ namespace, name, id }) => {
      table.addRow(namespace, name, id)
    })
    // Log da addons
    this.log(table.toString())
  }
}

AddonsListCommand.description = `List currently installed add-ons for site`
AddonsListCommand.aliases = ['addon:list']
AddonsListCommand.flags = {
  json: flagsLib.boolean({
    description: 'Output add-on data as JSON',
  }),
  ...AddonsListCommand.flags,
}

module.exports = AddonsListCommand
