const { flags } = require('@oclif/command')
const SitesWatchCommand = require('./watch')
const chalk = require('chalk')
const Command = require('../base')
const createOrFindSite = require('../utils/init/create-or-find-site')
const configManual = require('../utils/init/config-manual')
const configGithub = require('../utils/init/config-github')
const renderShortDesc = require('../utils/renderShortDescription')
const getRepoData = require('../utils/getRepoData')
const isEmpty = require('lodash.isempty')

class InitCommand extends Command {
  async run() {
    const { flags } = this.parse(InitCommand)
    await this.authenticate()

    // this.log('Configure continuous integration for a site')
    const repo = await getRepoData()

    if (repo.error) {
      console.log()
      console.log(`${chalk.redBright('Git Repo Error (╯°□°）╯︵ ┻━┻')}`)
      console.log()
      let message = ''
      switch (repo.error) {
        case 'Couldn\'t find origin url': {
          message = `Unable to find a remote origin url. Please add a git remote.

git remote add origin https://github.com/YourUserName/RepoName.git
`
          break
        }
      }
      console.log(message)
      this.error(repo.error)
    }

    const site = await createOrFindSite(this, flags, repo)

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

    this.log(`Your site is now configured to automatically deploy from git

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
  force: flags.boolean({
    description: 'Force init a site that is already configured to use CI'
  }),
  watch: flags.boolean({
    description: 'Make the CLI wait for the first deploy to complete after setting up CI'
  })
}

module.exports = InitCommand
