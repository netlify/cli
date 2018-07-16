const Command = require('../../base-command')
const renderShortDesc = require('../../utils/renderShortDescription')

class LoginCommand extends Command {
  async run() {
    // const { flags, args } = this.parse(LoginCommand)

    if (this.globalConfig.get('accessToken')) {
      this.log('Already logged in')
      return this.exit()
    }

    await this.config.runHook('login')

    return this.exit()
  }
}

LoginCommand.description = `${renderShortDesc('Login to account')}`

module.exports = LoginCommand
