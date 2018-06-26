const { Command } = require('@oclif/command')
const openBrowser = require('../../utils/open-browser')
const renderShortDesc = require('../../utils/renderShortDescription')
const API = require('../../utils/api')
const client = new API()
const config = require('../../utils/config')
const { CLIError } = require('@oclif/errors')

function waitForTicket(ticket, waitUntil) {
  if (waitUntil && new Date() > waitUntil) {
    return Promise.reject(new Error('Timeout while waiting for ticket grant'))
  }

  if (ticket.authorized) {
    return Promise.resolve(ticket)
  }

  const wait = new Promise(resolve => {
    setTimeout(() => resolve(ticket), 500)
  })
    .then(ticket => {
      return new Promise((resolve, reject) => {
        client.api.showTicket(ticket.id, (err, data) => {
          if (err) return reject(err)
          resolve(data)
        })
      })
    })
    .then(ticket => {
      return waitForTicket(ticket, waitUntil)
    })

  return wait
}

class LoginCommand extends Command {
  async run() {
    const { flags, args } = this.parse(LoginCommand)
    if (config.get('accessToken')) {
      this.log('Already logged in')
      return this.exit()
    }

    this.log(`Logging into Netlify account`)

    const ticket = await new Promise(resolve => {
      client.api.createTicket(config.get('clientId'), (err, ticket) => {
        if (err) throw new CLIError(err)
        resolve(ticket)
      })
    })

    openBrowser(`https://app.netlify.com/authorize?response_type=ticket&ticket=${ticket.id}`)

    const ts = new Date()
    ts.setHours(ts.getHours() + 1)

    const authorizedTicket = await waitForTicket(ticket, ts)

    const accessToken = await new Promise(resolve => {
      client.api.exchangeTicket(authorizedTicket.id, (err, accessToken) => {
        if (err) throw new CLIError(err)
        resolve(accessToken.access_token)
      })
    })

    config.set('accessToken', accessToken.access_token)
    this.log('Logged in!')
    return this.exit()
  }
}

LoginCommand.description = `${renderShortDesc('Login to account')}`

module.exports = LoginCommand
