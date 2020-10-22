const { flags: flagsLib } = require('@oclif/command')
const chalk = require('chalk')

const Command = require('../utils/command')

class LoginCommand extends Command {
  async run() {
    const { flags } = this.parse(LoginCommand)
    const [accessToken, location] = this.getConfigToken()
    if (accessToken && !flags.new) {
      this.log(`Already logged in ${msg(location)}`)
      this.log()
      this.log(`Run ${chalk.cyanBright('netlify status')} for account details`)
      this.log()
      this.log(`To see all available commands run: ${chalk.cyanBright('netlify help')}`)
      this.log()
      return this.exit()
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'login',
        new: flags.new,
      },
    })

    await this.expensivelyAuthenticate()

    return this.exit()
  }
}

const msg = function (location) {
  switch (location) {
    case 'env':
      return 'via process.env.NETLIFY_AUTH_TOKEN set in your terminal session'
    case 'flag':
      return 'via CLI --auth flag'
    case 'config':
      return 'via netlify config on your machine'
    default:
      return ''
  }
}

LoginCommand.flags = {
  new: flagsLib.boolean({
    description: 'Login to new Netlify account',
  }),
  ...LoginCommand.flags,
}
LoginCommand.description = `Login to your Netlify account

Opens a web browser to acquire an OAuth token.
`

module.exports = LoginCommand
