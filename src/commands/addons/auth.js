const { prepareAddonCommand, ADDON_VALIDATION } = require('../../utils/addons/prepare')
const Command = require('../../utils/command')
const openBrowser = require('../../utils/open-browser')
const { track } = require('../../utils/telemetry')

class AddonsAuthCommand extends Command {
  async run() {
    const { args } = this.parse(AddonsAuthCommand)

    await track('command', {
      command: 'addons:auth',
    })

    const addonName = args.name
    const { addon } = await prepareAddonCommand({
      context: this,
      addonName,
      validation: ADDON_VALIDATION.EXISTS,
    })

    if (!addon.auth_url) {
      console.log(`No Admin URL found for the "${addonName} add-on"`)
      return false
    }

    this.log()
    this.log(`Opening ${addonName} add-on admin URL:`)
    this.log()
    this.log(addon.auth_url)
    this.log()
    await openBrowser({ url: addon.auth_url, log: this.log })
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
