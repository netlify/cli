const { flags } = require('@oclif/command')
const inquirer = require('inquirer')
const isEmpty = require('lodash.isempty')
const prettyjson = require('prettyjson')
const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')

class SitesCreateCommand extends Command {
  async run() {
    await this.authenticate()
    const { flags } = this.parse(SitesCreateCommand)

    if (isEmpty(flags)) {
      const accounts = await this.netlify.listAccountsForUser()
      const personal = accounts.find(account => account.type === 'PERSONAL')
      const results = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Site name (optional):',
          filter: val => (val === '' ? undefined : val)
        },
        {
          type: 'list',
          name: 'accountSlug',
          message: 'Account:',
          default: personal.slug,
          choices: accounts.map(account => ({
            value: account.slug,
            name: `${account.name || account.slug} ${account.slug === personal.slug ? ' (personal)' : ''}`
          }))
        }
      ])

      const { accountSlug } = results
      delete results.accountSlug

      const site = await this.netlify.createSiteInTeam({ accountSlug, body: results })
      this.log(`Site created`)
      this.log(
        prettyjson.render({
          'Admin URL': site.admin_url,
          URL: site.url,
          'Site ID': site.id
        })
      )
      return site
    }
  }
}

SitesCreateCommand.description = `${renderShortDesc('Create an empty site (advanced)')}`

SitesCreateCommand.flags = {
  name: flags.string({
    char: 'n',
    description: 'name of site'
  }),
  password: flags.string({
    char: 'p',
    description: 'password protect the site'
  }),
  'force-tls': flags.boolean({
    char: 's',
    description: 'force TLS connections'
  }),
  'session-id': flags.string({
    char: 'i',
    description: 'session ID for later site transfers'
  }),
  'account-slug': flags.string({
    char: 'a',
    description: 'account slug to create the site under'
  }),
  'custom-domain': flags.string({
    char: 'c',
    description: 'custom domain to use with the site'
  })
}

module.exports = SitesCreateCommand
