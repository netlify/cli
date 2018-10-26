const Command = require('../../base')
const OpenAdminCommand = require('./admin')
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

OpenCommand.description = `Open settings for the site linked to the current folder`

OpenCommand.examples = [
  'netlify open:admin',
  'netlify open:site'
]

module.exports = OpenCommand
