const Command = require('../base')
const renderShortDesc = require('../utils/renderShortDescription')

class LogoutCommand extends Command {
  async run() {
    const accessToken = this.getAuthToken()

    if (accessToken) {
      // unset userID without deleting key
      this.netlify.globalConfig.set('userId', null)
      this.log(`Logging you out of Netlify. Come back soon!`)
    } else {
      this.log(`Already logged out`)
    }
  }
}

LogoutCommand.description = `${renderShortDesc('Logout of your Netlify account')}`

module.exports = LogoutCommand
