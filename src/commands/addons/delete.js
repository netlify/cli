const Command = require('../../utils/command')
const inquirer = require('inquirer')
const { parseRawFlags } = require('../../utils/parse-raw-flags')
const { flags: flagsLib } = require('@oclif/command')
const { prepareAddonCommand, ADDON_VALIDATION } = require('../../utils/addons/prepare')

class AddonsDeleteCommand extends Command {
  async run() {
    const { args, raw } = this.parse(AddonsDeleteCommand)
    const addonName = args.name
    const { addon } = await prepareAddonCommand({
      context: this,
      addonName,
      validation: ADDON_VALIDATION.EXISTS,
    })

    const { force, f } = parseRawFlags(raw)
    if (!force && !f) {
      const { wantsToDelete } = await inquirer.prompt({
        type: 'confirm',
        name: 'wantsToDelete',
        message: `Are you sure you want to delete the ${addonName} add-on? (to skip this prompt, pass a --force flag)`,
        default: false,
      })
      if (!wantsToDelete) {
        this.exit()
      }
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'addons:delete',
      },
    })

    try {
      await this.netlify.api.deleteServiceInstance({
        siteId: this.netlify.site.id,
        addon: addonName,
        instanceId: addon.id,
      })
      this.log(`Addon "${addonName}" deleted`)
    } catch (error) {
      this.error(error.message)
    }
  }
}

AddonsDeleteCommand.description = `Remove an add-on extension to your site
...
Add-ons are a way to extend the functionality of your Netlify site
`

// allow for any flags. Handy for variadic configuration options
AddonsDeleteCommand.strict = false
AddonsDeleteCommand.aliases = ['addon:delete']
AddonsDeleteCommand.flags = {
  force: flagsLib.boolean({
    char: 'f',
    description: 'delete without prompting (useful for CI)',
  }),
  ...AddonsDeleteCommand.flags,
}
AddonsDeleteCommand.args = [
  {
    name: 'name',
    required: true,
    description: 'Add-on namespace',
  },
]

module.exports = AddonsDeleteCommand
