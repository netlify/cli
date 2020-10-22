const { Command } = require('@oclif/command')

const { isEmptyCommand } = require('../../utils/check-command-inputs')
const showHelp = require('../../utils/show-help')

class AddonsCommand extends Command {
  async run() {
    const { flags, args } = this.parse(AddonsCommand)

    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
      this.exit()
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'addons',
      },
    })
  }
}

AddonsCommand.description = `(Beta) Manage Netlify Add-ons`
AddonsCommand.aliases = ['addon']
AddonsCommand.examples = [
  'netlify addons:create addon-xyz',
  'netlify addons:list',
  'netlify addons:config addon-xyz',
  'netlify addons:delete addon-xyz',
  'netlify addons:auth addon-xyz',
]

module.exports = AddonsCommand
