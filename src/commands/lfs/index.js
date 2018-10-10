const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const showHelp = require('../../utils/showHelp')
const { isEmptyCommand } = require('../../utils/checkCommandInputs')

class LfsCommand extends Command {
  async run() {
    const { flags, args } = this.parse(LfsCommand)
    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
      this.exit()
    }
  }
}

LfsCommand.description = `${renderShortDesc('Handle Asset Management/Netlify LFS operations')}`

LfsCommand.examples = [
  'netlify lfs:setup'
]

module.exports = LfsCommand
