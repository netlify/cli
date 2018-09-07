const { flags } = require('@oclif/command')
const inquirer = require('inquirer')
const isEmpty = require('lodash.isempty')
const prettyjson = require('prettyjson')
const chalk = require('chalk')
const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')

class SitesCreateCommand extends Command {
  async run() {
    const { flags } = this.parse(SitesCreateCommand)
    const { api } = this.netlify

    await this.authenticate()

    if (isEmpty(flags)) {
      const accounts = await api.listAccountsForUser()
      const personal = accounts.find(account => account.type === 'PERSONAL')
      console.log('Choose a site name. One will be automatically generated if left blank. You will be able to update this at a later time.')
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

      let site
      try {
        site = await api.createSiteInTeam({ accountSlug, body: results })
      } catch (error) {
        console.log(`Error ${error.status}: ${error.message} from createSiteInTeam call`)
        if (error.status === 422) {
          this.error(`A site with name ${results.name} already exists. Please try a different slug`)
        }
      }
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
      this.log()
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
