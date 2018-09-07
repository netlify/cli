const Command = require('../base')
const renderShortDesc = require('../utils/renderShortDescription')

class LogoutCommand extends Command {
  async run() {
    const { globalConfig } = this.netlify
    const current = globalConfig.get('userId')
    const accessToken = globalConfig.get(`users.${current}.auth.token`)

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
