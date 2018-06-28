const { Command } = require('@oclif/command')
const renderShortDesc = require('../../utils/renderShortDescription')
const config = require('../../utils/config')

class LoginCommand extends Command {
  async run() {
    // const { flags, args } = this.parse(LoginCommand)

    if (config.get('accessToken')) {
      this.log('Already logged in')
      return this.exit()
    }

    await this.config.runHook('login')

    return this.exit()
  }
}

LoginCommand.description = `${renderShortDesc('Login to account')}`

module.exports = LoginCommand
