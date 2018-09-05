const { flags } = require('@oclif/command')
const chalk = require('chalk')
const Command = require('../base')
const SitesWatchCommand = require('./watch')
const configManual = require('../utils/init/config-manual')
const configGithub = require('../utils/init/config-github')
const renderShortDesc = require('../utils/renderShortDescription')
const getRepoData = require('../utils/getRepoData')
const inquirer = require('inquirer')
const SitesCreateCommand = require('./sites/create')
const LinkCommand = require('./link')
const get = require('lodash.get')

class InitCommand extends Command {
  async run() {
    const { flags } = this.parse(InitCommand)
    // Check logged in status
    await this.authenticate()

    // Look for local repo
    const repo = await getRepoData()

    if (repo.error) {
      console.log()
      console.log(`${chalk.redBright('Git Repo Error (╯°□°）╯︵ ┻━┻')}`)
      console.log()
      let message
      switch (repo.error) {
        case 'Couldn\'t find origin url': {
          message = `Unable to find a remote origin url. Please add a git remote.

git remote add origin https://github.com/YourUserName/RepoName.git
`
          break
        }
      }
      if (message) {
        console.log(message)
      }
      // Throw github remote error
      this.error(repo.error)
    }

    let site
    const NEW_SITE = 'Configure a new site'
    const EXISTING_SITE = 'Link to an existing site'

    const initializeOpts = [
      NEW_SITE,
      EXISTING_SITE
    ]

    const { initChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'initChoice',
        message: 'What would you like to do?',
        choices: initializeOpts
      }
    ])

    // create site or search for one
    if (initChoice === NEW_SITE) {
      // run site:create command
      site = await SitesCreateCommand.run([])
    } else if (initChoice === EXISTING_SITE) {
      // run link command
      site = await LinkCommand.run([], false)
    }

    // Check for existing CI setup
    const remoteBuildRepo = get(site, 'build_settings.repo_url')
    if (remoteBuildRepo) {
      this.log()
      this.log(chalk.underline.bold(`Existing Repo detected`))
      const siteName = get(site, 'name')
      this.log(`This site "${siteName}" is already configured to automatically deploy via ${remoteBuildRepo}`)
      // TODO add support for changing github repo in site:config command
      
      if (flags.watch) {
        await SitesWatchCommand.run([])
      }
      this.exit()
    }

    this.site.set('siteId', site.id)

    if (flags.manual) {
      await configManual(this, site, repo)
    } else {
      switch (repo.provider) {
        case 'github': {
          await configGithub(this, site, repo)
          break
        }
        case 'gitlab':
        default: {
          this.error('No configurator found for the git hosting service')
        }
      }
    }

    // Success Message
    this.log()
    this.log(chalk.greenBright.bold.underline(`Netlify CI/CD Configured!`))
    this.log()
    this.log(`Your site is now configured to automatically deploy from git`)
    this.log()
    this.log(`Next steps:

  ${chalk.cyanBright.bold('git push')}       Push to your git repository to trigger new site builds
  ${chalk.cyanBright.bold('netlify open')}   Open the netlify admin url of your site
  `)

    if (flags.watch) {
      await SitesWatchCommand.run([])
    }
  }
}

InitCommand.description = `${renderShortDesc('Configure continuous deployment for a new or existing site')}`

InitCommand.flags = {
  manual: flags.boolean({
    description: 'Manually configure a git remote for CI'
  }),
  watch: flags.boolean({
    char: 'w',
    description: 'Make the CLI wait for the first deploy to complete after setting up CI'
  })
}

module.exports = InitCommand
