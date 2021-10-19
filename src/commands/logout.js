const Command = require('../utils/command')
const { exit, getToken, log } = require('../utils/command-helpers')
const { track } = require('../utils/telemetry')

class LogoutCommand extends Command {
  async run() {
    const [accessToken, location] = await getToken()

    if (!accessToken) {
      log(`Already logged out`)
      log()
      log('To login run "netlify login"')
      exit()
    }

    await track('user_logout')

    // unset userID without deleting key
    this.netlify.globalConfig.set('userId', null)

    if (location === 'env') {
      log('The "process.env.NETLIFY_AUTH_TOKEN" is still set in your terminal session')
      log()
      log('To logout completely, unset the environment variable')
      log()
      exit()
    }

    log(`Logging you out of Netlify. Come back soon!`)
  }
}

LogoutCommand.description = `Logout of your Netlify account`

LogoutCommand.hidden = true

module.exports = LogoutCommand
