const { Command } = require('@oclif/command')
const showHelp = require('../../utils/show-help')
const { isEmptyCommand } = require('../../utils/check-command-inputs')

class AddonsCommand extends Command {
  async run() {
    const { flags, args } = this.parse(AddonsCommand)

    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
      this.exit()
    }
  }
}

AddonsCommand.description = `Handle addon operations
The addons command will help you manage all your netlify addons
`
AddonsCommand.aliases = ['addon']
AddonsCommand.examples = [
  'netlify addons:create addon-xyz --value foo',
  'netlify addons:config addon-xyz --value bar',
  'netlify addons:delete addon-xyz',
  'netlify addons:list'
]

AddonsCommand.hidden = true

module.exports = AddonsCommand
