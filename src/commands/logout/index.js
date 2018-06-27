const { Command } = require('@oclif/command')
const renderShortDesc = require('../../utils/renderShortDescription')
const config = require('../../utils/config')

class LogoutCommand extends Command {
  async run() {
    const { flags, args } = this.parse(LogoutCommand)
    config.delete('accessToken')
    this.log(`Logging you out of Netlify. Come back soon`)
    this.exit()
  }
}

LogoutCommand.description = `${renderShortDesc('Logout of account')}`

module.exports = LogoutCommand
