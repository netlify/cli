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

AddonsCommand.description = `Handle Netlify add-on operations
The addons command will help you manage all your netlify addons
`
AddonsCommand.aliases = ['addon']
AddonsCommand.examples = [
  'netlify addons:list',
  'netlify addons:create addon-xyz',
  'netlify addons:config addon-xyz',
  'netlify addons:delete addon-xyz',
  'netlify addons:auth addon-xyz'
]

AddonsCommand.hidden = true

module.exports = AddonsCommand
