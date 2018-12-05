const Command = require('../base')
const { track } = require('../utils/telemetry')

class LogoutCommand extends Command {
  async run() {
    const accessToken = this.configToken

    if (accessToken) {
      await track('user_logout')

      // unset userID without deleting key
      this.netlify.globalConfig.set('userId', null)

      this.log(`Logging you out of Netlify. Come back soon!`)

    } else {
      this.log(`Already logged out`)
    }
  }
}

LogoutCommand.description = `Logout of your Netlify account`

LogoutCommand.hidden = true

module.exports = LogoutCommand
