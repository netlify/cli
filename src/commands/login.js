const Command = require('../base')
const renderShortDesc = require('../utils/renderShortDescription')

class LoginCommand extends Command {
  async run() {
    // const { flags, args } = this.parse(LoginCommand)

    if (this.global.get('accessToken')) {
      this.error('Already logged in')
    }

    await this.authenticate()

    return this.exit()
  }
}

LoginCommand.description = `${renderShortDesc('Login to your Netlify account')}

Opens a web browser to acquire an OAuth token.`

module.exports = LoginCommand
