const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')

class WhoamiCommand extends Command {
  async run() {
    const accessToken = this.global.get('accessToken')
    if (accessToken) {
      const accounts = await this.netlify.api.listAccountsForUser()
      const personal = accounts.find(account => account.type === 'PERSONAL')
      if (personal.name) this.log(`Account name: ${personal.name}`)
      if (personal.slug) this.log(`Account slug: ${personal.slug}`)
      if (personal.id) this.log(`Account id: ${personal.id}`)
      if (personal.billing_name) this.log(`Name: ${personal.billing_name}`)
      if (personal.billing_email) this.log(`Email: ${personal.billing_email}`)
      const teams = accounts.filter(account => account.type !== 'PERSONAL')
      if (teams.length > 0) {
        this.log('')
        this.log('Teams:')
        teams.forEach(team => {
          this.log(`${team.name} - ${team.roles_allowed.join(' ')}`)
        })
      }
    } else {
      this.log(`Not logged in`)
    }
  }
}

WhoamiCommand.description = `${renderShortDesc('Print currently logged in use')}`

module.exports = WhoamiCommand
