const { Command } = require('@oclif/command')
const openBrowser = require('../../utils/open-browser')
const renderShortDesc = require('../../utils/renderShortDescription')
const API = require('../../utils/api')
const client = new API()
const config = require('../../utils/config')

class LoginCommand extends Command {
  async run() {
    // const { flags, args } = this.parse(LoginCommand)

    if (config.get('accessToken')) {
      this.log('Already logged in')
      return this.exit()
    }

    this.log(`Logging into Netlify account`)

    const ticket = await client.api.createTicket(config.get('clientId'))
    openBrowser(`https://app.netlify.com/authorize?response_type=ticket&ticket=${ticket.id}`)
    const accessToken = await client.waitForAccessToken(ticket)

    config.set('accessToken', accessToken)
    this.log('Logged in!')
    return this.exit()
  }
}

LoginCommand.description = `${renderShortDesc('Login to account')}`

module.exports = LoginCommand
