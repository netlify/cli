const Command = require('../base')
const renderShortDesc = require('../utils/renderShortDescription')

class LogoutCommand extends Command {
  async run() {
    if (this.global.get('accessToken')) {
      this.global.delete('accessToken')
      this.log(`Logging you out of Netlify. Come back soon!`)
    } else {
      this.log(`Already logged out`)
    }
  }
}

LogoutCommand.description = `${renderShortDesc('Logout of your Netlify account')}`

module.exports = LogoutCommand
