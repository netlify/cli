const { Command } = require('@oclif/command')
const openBrowser = require('../../utils/open-browser')

class LoginCommand extends Command {
  async run() {
    const { flags, args} = this.parse(LoginCommand)
    this.log(`Logging into Netlify account`)

    openBrowser('https://app.netlify.com/')

    await this.config.runHook('analytics', {id: 'my_command'})

    this.exit()
  }
}

LoginCommand.description = `Login to account`

module.exports = LoginCommand
