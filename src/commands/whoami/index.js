const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const get = require('lodash.get')
const clean = require('clean-deep')
const prettyjson = require('prettyjson')

class WhoamiCommand extends Command {
  async run() {
    const accessToken = this.global.get('accessToken')
    if (accessToken) {
      const accounts = await this.netlify.listAccountsForUser()
      const personal = accounts.find(account => account.type === 'PERSONAL')
      const teams = accounts.filter(account => account.type !== 'PERSONAL')
      const data = {
        'Account name': get(personal, 'name'),
        'Account slug': get(personal, 'slug'),
        'Account id': get(personal, 'id'),
        Name: get(personal, 'billing_name'),
        Email: get(personal, 'billing_email')
      }
      const teamsData = {}

      teams.forEach(team => {
        return (teamsData[team.name] = team.roles_allowed.join(' '))
      })

      data.Teams = teamsData

      this.log(prettyjson.render(clean(data)))
    } else {
      this.error(`Not logged in`)
    }
  }
}

WhoamiCommand.description = `${renderShortDesc('Print currently logged in user and account info')}`

module.exports = WhoamiCommand
