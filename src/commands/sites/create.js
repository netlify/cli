const { flags } = require('@oclif/command')
const inquirer = require('inquirer')
const isEmpty = require('lodash.isempty')
const prettyjson = require('prettyjson')
const chalk = require('chalk')
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
      this.log()
      this.log(chalk.greenBright.bold.underline(`Site Created`))
      this.log()
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
  })
}

module.exports = SitesCreateCommand
