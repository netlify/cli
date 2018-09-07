const { Command } = require('@oclif/command')
const renderShortDesc = require('../../utils/renderShortDescription')
const showHelp = require('../../utils/showHelp')
const { isEmptyCommand } = require('../../utils/checkCommandInputs')

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

AddonsCommand.description = `${renderShortDesc('Handle addon operations')}
The addons command will help you manage all your netlify addons
`

AddonsCommand.examples = [
  'netlify addons:create addon-xyz --value foo',
  'netlify addons:update addon-xyz --value bar',
  'netlify addons:delete addon-xyz',
  'netlify addons:list'
]

AddonsCommand.hidden = true

module.exports = AddonsCommand
