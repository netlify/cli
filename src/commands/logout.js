const Command = require('../base')
const renderShortDesc = require('../utils/renderShortDescription')

class LogoutCommand extends Command {
  async run() {
    const current = this.global.get('userId')
    const accessToken = this.global.get(`users.${current}.auth.token`)

    if (accessToken) {
      // unset userID without deleting key
      this.global.set('userId', null)
      this.log(`Logging you out of Netlify. Come back soon!`)
    } else {
      this.log(`Already logged out`)
    }
  }
}

LogoutCommand.description = `${renderShortDesc('Logout of your Netlify account')}`

module.exports = LogoutCommand
