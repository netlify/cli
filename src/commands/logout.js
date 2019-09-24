const Command = require('../utils/command')
const { track } = require('../utils/telemetry')

class LogoutCommand extends Command {
  async run() {
    const [accessToken, location] = this.getConfigToken()

    if (!accessToken) {
      this.log(`Already logged out`)
      this.log()
      this.log('To login run "netlify login"')
      this.exit()
    }

    await track('user_logout')

    // unset userID without deleting key
    this.netlify.globalConfig.set('userId', null)

    if (location === 'env') {
      this.log('The "process.env.NETLIFY_AUTH_TOKEN" is still set in your terminal session')
      this.log()
      this.log('To logout completely, unset the environment variable')
      this.log()
      this.exit()
    }

    this.log(`Logging you out of Netlify. Come back soon!`)
  }
}

LogoutCommand.description = `Logout of your Netlify account`

LogoutCommand.hidden = true

module.exports = LogoutCommand
