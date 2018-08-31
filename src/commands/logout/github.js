const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')

class LogoutGithubCommand extends Command {
  async run() {
    if (this.global.get('ghauth')) {
      const loggedInUser = this.global.get('ghauth.user')
      this.global.delete('ghauth')
      this.log(`Logging ${loggedInUser} out of Github`)
    } else {
      this.log(`Already logged out of Github`)
    }
  }
}

LogoutGithubCommand.description = `${renderShortDesc('Logout of your Github account')}`

module.exports = LogoutGithubCommand
