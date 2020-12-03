const { flags: flagsLib } = require('@oclif/command')
const chalk = require('chalk')
const inquirer = require('inquirer')
const pick = require('lodash/pick')
const sample = require('lodash/sample')
const prettyjson = require('prettyjson')

const Command = require('../../utils/command')
const { getRepoData } = require('../../utils/get-repo-data')
const { configureRepo } = require('../../utils/init/config')
const { track } = require('../../utils/telemetry')

class SitesCreateCommand extends Command {
  async run() {
    const { flags } = this.parse(SitesCreateCommand)
    const { api } = this.netlify

    await this.authenticate()

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'sites:create',
      },
    })

    const accounts = await api.listAccountsForUser()

    let accountSlug = flags['account-slug']
    if (!accountSlug) {
      const { accountSlug: accountSlugInput } = await inquirer.prompt([
        {
          type: 'list',
          name: 'accountSlug',
          message: 'Team:',
          choices: accounts.map((account) => ({
            value: account.slug,
            name: account.name,
          })),
        },
      ])
      accountSlug = accountSlugInput
    }

    const { name: nameFlag } = flags
    let userName
    let site

    // Allow the user to reenter site name if selected one isn't available
    const inputSiteName = async (name) => {
      if (!userName) userName = await api.getCurrentUser()

      if (!name) {
        const suggestions = [
          `super-cool-site-by-${userName.slug}`,
          `the-awesome-${userName.slug}-site`,
          `${userName.slug}-makes-great-sites`,
          `netlify-thinks-${userName.slug}-is-great`,
          `the-great-${userName.slug}-site`,
          `isnt-${userName.slug}-awesome`,
        ]
        const siteSuggestion = sample(suggestions)

        console.log(
          `Choose a unique site name (e.g. ${siteSuggestion}.netlify.app) or leave it blank for a random name. You can update the site name later.`,
        )
        const { name: nameInput } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Site name (optional):',
            filter: (val) => (val === '' ? undefined : val),
            validate: (input) => /^[a-zA-Z\d-]+$/.test(input) || 'Only alphanumeric characters and hyphens are allowed',
          },
        ])
        name = nameInput
      }

      const body = {}
      if (typeof name === 'string') {
        body.name = name.trim()
      }
      try {
        site = await api.createSiteInTeam({
          accountSlug,
          body,
        })
      } catch (error) {
        if (error.status === 422) {
          this.warn(`${name}.netlify.app already exists. Please try a different slug.`)
          await inputSiteName()
        } else {
          this.error(`createSiteInTeam error: ${error.status}: ${error.message}`)
        }
      }
    }
    await inputSiteName(nameFlag)

    this.log()
    this.log(chalk.greenBright.bold.underline(`Site Created`))
    this.log()

    const siteUrl = site.ssl_url || site.url
    this.log(
      prettyjson.render({
        'Admin URL': site.admin_url,
        URL: siteUrl,
        'Site ID': site.id,
      }),
    )

    track('sites_created', {
      siteId: site.id,
      adminUrl: site.admin_url,
      siteUrl,
    })

    if (flags['with-ci']) {
      this.log('Configuring CI')
      const repoData = await getRepoData({ log: this.log })
      await configureRepo({ context: this, siteId: site.id, repoData, manual: flags.manual })
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
          'id_domain',
        ]),
      )
    }

    return site
  }
}

SitesCreateCommand.description = `Create an empty site (advanced)

Create a blank site that isn't associated with any git remote.  Does not link to the current working directory.
`

SitesCreateCommand.flags = {
  name: flagsLib.string({
    char: 'n',
    description: 'name of site',
  }),
  'account-slug': flagsLib.string({
    char: 'a',
    description: 'account slug to create the site under',
  }),
  'with-ci': flagsLib.boolean({
    char: 'c',
    description: 'initialize CI hooks during site creation',
  }),
  manual: flagsLib.boolean({
    char: 'm',
    description: 'Force manual CI setup.  Used --with-ci flag',
  }),
  ...SitesCreateCommand.flags,
}

module.exports = SitesCreateCommand
