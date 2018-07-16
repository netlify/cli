const { Command } = require('@oclif/command')
const renderShortDesc = require('../../utils/renderShortDescription')

class LogoutCommand extends Command {
  async run() {
    if (this.globalConfig.get('accessToken')) {
      this.globalConfig.delete('accessToken')
      this.log(`Logging you out of Netlify. Come back soon!`)
    } else {
      this.log(`Already logged out`)
    }
  }
}

LogoutCommand.description = `${renderShortDesc('Logout of account')}`

module.exports = LogoutCommand
