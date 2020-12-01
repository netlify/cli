const { flags: flagsLib } = require('@oclif/command')
const chalk = require('chalk')
const inquirer = require('inquirer')
const get = require('lodash/get')
const isEmpty = require('lodash/isEmpty')

const Command = require('../utils/command')
const getRepoData = require('../utils/get-repo-data')
const { ensureNetlifyIgnore } = require('../utils/gitignore')
const configGithub = require('../utils/init/config-github')
const configManual = require('../utils/init/config-manual')
const { track } = require('../utils/telemetry')

const LinkCommand = require('./link')
const SitesCreateCommand = require('./sites/create')

class InitCommand extends Command {
  async run() {
    const { flags } = this.parse(InitCommand)
    const { site, state } = this.netlify
    let { siteInfo } = this.netlify

    // Check logged in status
    await this.authenticate()

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'init',
        manual: flags.manual,
        force: flags.force,
      },
    })

    // Add .netlify to .gitignore file
    await ensureNetlifyIgnore(site.root)

    const repoUrl = get(siteInfo, 'build_settings.repo_url')
    if (repoUrl && !flags.force) {
      this.log()
      this.log(`This site has been initialized`)
      this.log()
      this.log(`Site Name:  ${chalk.cyan(siteInfo.name)}`)
      this.log(`Site Url:   ${chalk.cyan(siteInfo.ssl_url || siteInfo.url)}`)
      this.log(`Site Repo:  ${chalk.cyan(repoUrl)}`)
      this.log(`Site Id:    ${chalk.cyan(siteInfo.id)}`)
      this.log(`Admin URL:  ${chalk.cyan(siteInfo.admin_url)}`)
      this.log()
      this.log(`To disconnect this directory and create a new site (or link to another siteId)`)
      this.log(`1. Run ${chalk.cyanBright.bold('netlify unlink')}`)
      this.log(`2. Then run ${chalk.cyanBright.bold('netlify init')} again`)
      this.exit()
    }

    // Look for local repo
    const repo = await getRepoData(flags.gitRemoteName)

    if (repo.error) {
      this.log()
      this.log(`${chalk.yellow('No git remote was found, would you like to set one up?')}`)
      this.log(`
It is recommended that you initialize a site that has a remote repository in GitHub.

This will allow for Netlify Continuous deployment to build branch & PR previews.

For more details on Netlify CI checkout the docs: http://bit.ly/2N0Jhy5
`)
      if (repo.error === "Couldn't find origin url") {
        this.log(`Unable to find a remote origin URL. Please add a git remote.

git remote add origin https://github.com/YourUserName/RepoName.git
`)
      }

      const NEW_SITE_NO_GIT = 'Yes, create and deploy site manually'
      const NO_ABORT = 'No, I will connect this directory with GitHub first'

      const { noGitRemoteChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'noGitRemoteChoice',
          message: 'Do you want to create a Netlify site without a git repository?',
          choices: [NEW_SITE_NO_GIT, NO_ABORT],
        },
      ])

      // create site or search for one
      if (noGitRemoteChoice === NEW_SITE_NO_GIT) {
        // run site:create command
        siteInfo = await SitesCreateCommand.run([])

        this.log(`"${siteInfo.name}" site was created`)
        this.log()
        this.log(`To deploy to this site. Run your site build and then ${chalk.cyanBright.bold('netlify deploy')}`)

        // Save to .netlify/state.json file
        state.set('siteId', siteInfo.id)

        // no github remote
        this.exit()
      } else if (noGitRemoteChoice === NO_ABORT) {
        this.log()
        this.log(`${chalk.bold('To initialize a new git repo follow the steps below.')}

1. Initialize a new repo:

   ${chalk.cyanBright.bold('git init')}

2. Commit your files

   ${chalk.cyanBright.bold('git add .')}

3. Commit your files

   ${chalk.cyanBright.bold("git commit -m 'initial commit'")}

4. Create a new repo in GitHub ${chalk.cyanBright.bold('https://github.com/new')}

5. Link the remote repo with this local directory

   ${chalk.cyanBright.bold('git remote add origin git@github.com:YourGithubName/your-repo-slug.git')}

6. Push up your files

   ${chalk.cyanBright.bold('git push -u origin master')}

7. Initialize your Netlify Site

   ${chalk.cyanBright.bold('netlify init')}
`)
        this.exit()
      }

      // Throw github remote error
      this.error(repo.error)
    }

    if (isEmpty(siteInfo)) {
      const NEW_SITE = '+  Create & configure a new site'
      const EXISTING_SITE = '⇄  Connect this directory to an existing Netlify site'

      const initializeOpts = [EXISTING_SITE, NEW_SITE]

      const { initChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'initChoice',
          message: 'What would you like to do?',
          choices: initializeOpts,
        },
      ])

      // create site or search for one
      if (initChoice === NEW_SITE) {
        await track('sites_initStarted', {
          type: 'new site',
        })
        // run site:create command
        siteInfo = await SitesCreateCommand.run([])
      } else if (initChoice === EXISTING_SITE) {
        // run link command
        siteInfo = await LinkCommand.run([], false)
      }
    }

    // Check for existing CI setup
    const remoteBuildRepo = get(siteInfo, 'build_settings.repo_url')
    if (remoteBuildRepo && !flags.force) {
      this.log()
      this.log(chalk.underline.bold(`Success`))
      const siteName = get(siteInfo, 'name')
      this.log(`This site "${siteName}" is configured to automatically deploy via ${remoteBuildRepo}`)
      // TODO add support for changing github repo in site:config command
      this.exit()
    }

    // Save to .netlify/state.json file
    state.set('siteId', siteInfo.id)

    if (flags.manual) {
      await configManual(this, siteInfo, repo)
    } else {
      switch (repo.provider) {
        case 'github': {
          try {
            await configGithub(this, siteInfo, repo)
          } catch (error) {
            this.warn(`GitHub error: ${error.status}`)
            if (error.status === 404) {
              this.error(
                `Does the repository ${repo.repo_path} exist and do you have the correct permissions to set up deploy keys?`,
              )
            } else {
              throw error
            }
          }
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
    this.log(chalk.greenBright.bold.underline(`Success! Netlify CI/CD Configured!`))
    this.log()
    this.log(`This site is now configured to automatically deploy from ${repo.provider} branches & pull requests`)
    this.log()
    this.log(`Next steps:

  ${chalk.cyanBright.bold('git push')}       Push to your git repository to trigger new site builds
  ${chalk.cyanBright.bold('netlify open')}   Open the Netlify admin URL of your site
  `)

    return siteInfo
  }
}

InitCommand.description = `Configure continuous deployment for a new or existing site`

InitCommand.flags = {
  manual: flagsLib.boolean({
    char: 'm',
    description: 'Manually configure a git remote for CI',
  }),
  force: flagsLib.boolean({
    description: 'Reinitialize CI hooks if the linked site is already configured to use CI',
  }),
  gitRemoteName: flagsLib.string({
    description: 'Name of Git remote to use. e.g. "origin"',
  }),
  ...InitCommand.flags,
}

module.exports = InitCommand
