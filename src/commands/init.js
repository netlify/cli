const { flags } = require('@oclif/command')
const gitRepoInfo = require('git-repo-info')
const parseGitRemote = require('parse-github-url')
const gitRemoteOriginUrl = require('git-remote-origin-url')
const SitesWatchCommand = require('./watch')

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

    this.log('Configure continuous integration for a site')
    const repo = await getRepoData()
    if (repo.error) {
      this.error(repo.error)
    }
    if (isEmpty(repo)) {
      this.error('CI requires a git remote.  No git remote found.')
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
    this.log('Site is now configured to automatically deploy')
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
