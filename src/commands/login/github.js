const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')

class LoginGithubCommand extends Command {
  async run() {
    // const { flags, args } = this.parse(LoginCommand)

    if (this.global.get('ghauth')) {
      this.error(`Already logged in as ${this.global.get('ghauth.user')}`)
    }

    await this.authenticate()

    return this.exit()
  }
}

LoginGithubCommand.description = `${renderShortDesc('Login to your Netlify account')}

Opens a web browser to acquire an OAuth token.`

module.exports = LoginGithubCommand
