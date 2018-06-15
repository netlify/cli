const { Command } = require('@oclif/command')
const renderShortDesc = require('../../utils/renderShortDescription')

class LogoutCommand extends Command {
  async run() {
    const { flags, args} = this.parse(LogoutCommand)
    this.log(`Logging you out of Netlify. Come back soon`)
  }
}

LogoutCommand.description = `${renderShortDesc('Logout of account')}`

module.exports = LogoutCommand
