const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const showHelp = require('../../utils/showHelp')
const { isEmptyCommand } = require('../../utils/checkCommandInputs')

class AssetMgmtCommand extends Command {
  async run() {
    const { flags, args } = this.parse(AssetMgmtCommand)
    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
      this.exit()
    }
  }
}

AssetMgmtCommand.description = `${renderShortDesc('Handle Asset Management operations')}`

AssetMgmtCommand.examples = [
  'netlify asset-mgmt:setup'
]

module.exports = AssetMgmtCommand
