const { Command } = require('@oclif/command')
const renderShortDesc = require('../../utils/renderShortDescription')
const config = require('../../utils/config')

class LogoutCommand extends Command {
  async run() {
    if (config.get('accessToken')) {
      config.delete('accessToken')
      this.log(`Logging you out of Netlify. Come back soon!`)
    } else {
      this.log(`Already logged out`)
    }
  }
}

LogoutCommand.description = `${renderShortDesc('Logout of account')}`

module.exports = LogoutCommand
