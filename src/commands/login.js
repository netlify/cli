const Command = require('../base')
const chalk = require('chalk')

class LoginCommand extends Command {
  async run() {
    const accessToken = this.configToken

    if (accessToken) {
      this.log('Already logged in!')
      this.log()
      this.log(`Run ${chalk.cyanBright('netlify status')} for account details`)
      this.log()
      this.log(`To see all available commands run: ${chalk.cyanBright('netlify help')}`)
      this.log()
      return this.exit()
    }

    await this.authenticate()

    return this.exit()
  }
}

LoginCommand.description = `Login to your Netlify account

Opens a web browser to acquire an OAuth token.  Use NETLIFY_WEB_UI to set the base URL of the ticket URL.
`

module.exports = LoginCommand
