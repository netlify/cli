const Command = require('../../base')
const openBrowser = require('../../utils/open-browser')
const OpenAdminCommand = require('./admin')
const renderShortDesc = require('../../utils/renderShortDescription')
const showHelp = require('../../utils/showHelp')
const { isEmptyCommand } = require('../../utils/checkCommandInputs')

class OpenCommand extends Command {
  async run() {
    const { flags, args } = this.parse(OpenCommand)
    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
    }
    // Default open netlify admin
    await OpenAdminCommand.run()
  }
}

OpenCommand.description = `${renderShortDesc('Opens current project urls in browser')}`

OpenCommand.examples = [
  '$ netlify open:admin',
  '$ netlify open:site',
]

OpenCommand.hidden = true

module.exports = OpenCommand
