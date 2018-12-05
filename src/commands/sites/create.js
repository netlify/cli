const { flags } = require('@oclif/command')
const inquirer = require('inquirer')
const prettyjson = require('prettyjson')
const chalk = require('chalk')
const Command = require('../../base')
const { track } = require('../../utils/telemetry')
const configManual = require('../../utils/init/config-manual')
const parseGitRemote = require('parse-github-url')
const configGithub = require('../../utils/init/config-github')

class SitesCreateCommand extends Command {
  async run() {
    const { flags } = this.parse(SitesCreateCommand)
    const { api } = this.netlify

    await this.authenticate()

    const accounts = await api.listAccountsForUser()
    const personal = accounts.find(account => account.type === 'PERSONAL')

    let name = flags.name
    if (!name) {
      console.log('Choose a site name or leave blank for a random name. You can update later.')
      const results = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Site name (optional):',
          filter: val => (val === '' ? undefined : val)
        }
      ])
      name = results.name
    }

    let accountSlug = flags['account-slug']
    if (!accountSlug) {
      const results = await inquirer.prompt([
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

    track('sites_created', {
      siteId: site.id,
      adminUrl: site.admin_url,
      siteUrl: url
    })

    if (flags['with-ci']) {
      this.log('Configuring CI')
      const { url } = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'Git SSH remote URL to enable CI with:',
          validate: input => (parseGitRemote(input) ? true : `Could not parse Git remote ${input}`)
        }
      ])
      console.log(url)
      const repoData = parseGitRemote(url)
      const repo = {
        repoData,
        repo_path: url
      }

      switch (true) {
        case flags.manual: {
          await configManual(this, site, repo)
          break
        }
        case repoData.host === 'github.com': {
          try {
            await configGithub(this, site, repo)
          } catch (e) {
            this.warn(`Github error: ${e.status}`)
            if (e.code === 404) {
              this.error(
                `Does the repository ${
                  repo.repo_path
                } exist and do you have the correct permissions to set up deploy keys?`
              )
            } else {
              throw e
            }
          }
          break
        }
        default: {
          this.log('No configurator found for the provided git remote. Configuring manually...')
          await configManual(this, site, repo)
          break
        }
      }
    }

    return site
  }
}

SitesCreateCommand.description = `Create an empty site (advanced)

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
  }),
  'with-ci': flags.boolean({
    char: 'c',
    description: 'initialize CI hooks during site creation'
  }),
  manual: flags.boolean({
    char: 'm',
    description: 'Force manual CI setup.  Used --with-ci flag'
  })
}

module.exports = SitesCreateCommand
