const { Command } = require('@oclif/command')
const openBrowser = require('../../utils/open-browser')
const renderShortDesc = require('../../utils/renderShortDescription')
const API = require('../../utils/api')
const config = require('../../utils/config')

function waitForTicket(ticket, waitUntil) {
  if (waitUntil && new Date() > waitUntil) {
    return Promise.reject(new Error('Timeout while waiting for ticket grant'))
  }

  if (ticket.authorized) {
    return Promise.resolve(ticket)
  }

  const wait = new Promise(resolve => {
    setTimeout(resolve(ticket), 500)
  })
    .then(ticket => {
      // "Refresh" somehow
      return ticket
    })
    .then(function(ticket) {
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

    const client = new API()
    this.log(`Logging into Netlify account`)

    const getTicket = new Promise((resolve, reject) => {
      client.api.createTicket(config.get('clientId'), (err, ticket) => {
        if (err) return reject(err)
        resolve(ticket)
      })
    })

    getTicket
      .then(ticket =>
        openBrowser(`https://app.netlify.com/authorize?response_type=ticket&ticket=${ticket.id}`).then(() => ticket)
      )
      .then(ticket => {
        const ts = new Date()
        ts.setHours(ts.getHours() + 1)
        return waitForTicket(ticket, ts)
          .then(ticket => {
            return new Promise((resolve, reject) => {
              client.api.exchangeTicket(ticket.id, (err, accessToken) => {
                if (err) return reject(err)
                resolve(accessToken)
              })
            })
          })
          .then(accessToken => {
            config.set('accessToken', accessToken)
            this.log('Logged in!')
          })
      })

    return getTicket
  }
}

LoginCommand.description = `${renderShortDesc('Login to account')}`

module.exports = LoginCommand
