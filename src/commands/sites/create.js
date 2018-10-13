const { flags } = require('@oclif/command')
const inquirer = require('inquirer')
const isEmpty = require('lodash.isempty')
const prettyjson = require('prettyjson')
const chalk = require('chalk')
const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const { track } = require('../../utils/telemetry')

class SitesCreateCommand extends Command {
  async run() {
    const { flags } = this.parse(SitesCreateCommand)
    const { api } = this.netlify

    await this.authenticate()
    let accountSlug = flags['account-slug']
    let name = flags.name
    const accounts = await api.listAccountsForUser()
    const personal = accounts.find(account => account.type === 'PERSONAL')
    if (isEmpty(flags)) {
      console.log('Choose a site name or leave blank for a random name. You can update later.')
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
      accountSlug = results.accountSlug
      name = results.name
    }

    let site
    let body = {}
    if (typeof name === 'string') {
      body.name = name.trim()
    }
    try {
      site = await api.createSiteInTeam({
        accountSlug: accountSlug || personal.slug,
        body
      })
    } catch (error) {
      console.log(`Error ${error.status}: ${error.message} from createSiteInTeam call`)
      if (error.status === 422) {
        this.error(`A site with name ${name} already exists. Please try a different slug`)
      }
    }
    this.log()
    this.log(chalk.greenBright.bold.underline(`Site Created`))
    this.log()

    const url = site.ssl_url || site.url
    this.log(
      prettyjson.render({
        'Admin URL': site.admin_url,
        URL: url,
        'Site ID': site.id
      })
    )

    this.log()

    track('sites_created', {
      siteId: site.id,
      adminUrl: site.admin_url,
      siteUrl: url
    })

    return site
  }
}

SitesCreateCommand.description = `${renderShortDesc('Create an empty site (advanced)')}

Create a blank site that isn't associated with any git remote.  Does not link to the current working directory.
`

SitesCreateCommand.flags = {
  name: flags.string({
    char: 'n',
    description: 'name of site'
  }),
  'account-slug': flags.string({
    char: 'a',
    description: 'account slug to create the site under'
  })
}

module.exports = SitesCreateCommand
