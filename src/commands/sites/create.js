const { flags } = require('@oclif/command')
const inquirer = require('inquirer')
const prettyjson = require('prettyjson')
const chalk = require('chalk')
const sample = require('lodash.sample')
const pick = require('lodash.pick')
const Command = require('../../utils/command')
const { track } = require('../../utils/telemetry')
const configManual = require('../../utils/init/config-manual')
const parseGitRemote = require('parse-github-url')
const configGithub = require('../../utils/init/config-github')

class SitesCreateCommand extends Command {
  async run() {
    const { flags } = this.parse(SitesCreateCommand)
    const { api } = this.netlify

    await this.authenticate()

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'sites:create'
      }
    })

    const accounts = await api.listAccountsForUser()

    let accountSlug = flags['account-slug']
    if (!accountSlug) {
      const results = await inquirer.prompt([
        {
          type: 'list',
          name: 'accountSlug',
          message: 'Team:',
          choices: accounts.map(account => ({
            value: account.slug,
            name: account.name
          }))
        }
      ])
      accountSlug = results.accountSlug
    }

    let name = flags.name
    let userName
    let site

    // Allow the user to reenter site name if selected one isn't available
    const inputSiteName = async name => {
      if (!userName) userName = await api.getCurrentUser()

      if (!name) {
        const suggestions = [
          `super-cool-site-by-${userName.slug}`,
          `the-awesome-${userName.slug}-site`,
          `${userName.slug}-makes-great-sites`,
          `netlify-thinks-${userName.slug}-is-great`,
          `the-great-${userName.slug}-site`,
          `isnt-${userName.slug}-awesome`
        ]
        const siteSuggestion = sample(suggestions)

        console.log(
          `Choose a unique site name (e.g. ${siteSuggestion}.netlify.com) or leave it blank for a random name. You can update the site name later.`
        )
        const results = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Site name (optional):',
            filter: val => (val === '' ? undefined : val),
            validate: input => /^[a-zA-Z0-9-]+$/.test(input) || 'Only alphanumeric characters and hyphens are allowed'
          }
        ])
        name = results.name
      }

      let body = {}
      if (typeof name === 'string') {
        body.name = name.trim()
      }
      try {
        site = await api.createSiteInTeam({
          accountSlug: accountSlug,
          body
        })
      } catch (error) {
        if (error.status === 422) {
          this.warn(`${name}.netlify.com already exists. Please try a different slug.`)
          await inputSiteName()
        } else {
          this.error(`createSiteInTeam error: ${error.status}: ${error.message}`)
        }
      }
    }
    await inputSiteName(name)

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
                `Does the repository ${repo.repo_path} exist and do you have the correct permissions to set up deploy keys?`
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

    if (flags.json) {
      this.logJson(
        pick(site, [
          'id',
          'state',
          'plan',
          'name',
          'custom_domain',
          'domain_aliases',
          'url',
          'ssl_url',
          'admin_url',
          'screenshot_url',
          'created_at',
          'updated_at',
          'user_id',
          'ssl',
          'force_ssl',
          'managed_dns',
          'deploy_url',
          'account_name',
          'account_slug',
          'git_provider',
          'deploy_hook',
          'capabilities',
          'id_domain'
        ])
      )
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
