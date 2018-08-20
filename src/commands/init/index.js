const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const SitesCreateCommand = require('../sites/create')
const { flags } = require('@oclif/command')
const inquirer = require('inquirer')
const get = require('lodash.get')
const gitRemoteOriginUrl = require('git-remote-origin-url')
const parseGitRemote = require('parse-github-url')
const gitRepoInfo = require('git-repo-info')

class InitCommand extends Command {
  async createOrFindSite() {
    const { flags } = this.parse(InitCommand)
    // TODO Encapsulate this better
    // Prompt existing site
    // or Create a new site
    // or Search for an existing site
    const siteOpts = ['New site', 'Existing site']

    let linkedSite
    if (this.site.get('siteId')) {
      try {
        linkedSite = await this.netlify.getSite({ siteId: this.site.get('siteId') })
      } catch (_) {
        // noop
      }

      if (linkedSite) {
        siteOpts.unshift({
          name: `Linked site (${linkedSite.name})`,
          value: 'linked-site'
        })
      }
    }

    const { configureOption } = await inquirer.prompt([
      {
        type: 'list',
        name: 'configureOption',
        message: 'Site to configure:',
        choices: siteOpts
      }
    ])

    let site
    // create site or search for one
    if (configureOption === 'New site') {
      site = await SitesCreateCommand.run([])
    } else if (configureOption === 'linked-site') {
      site = linkedSite
    } else {
      // TODO share this with link site search step
      const { searchType } = await inquirer.prompt([
        {
          type: 'list',
          name: 'searchType',
          message: 'Search for site by:',
          choices: ['Site Name', 'Site ID']
        }
      ])

      switch (searchType) {
        case 'Site Name': {
          const { siteName } = await inquirer.prompt([
            {
              type: 'input',
              name: 'siteName',
              message: 'Search by site name:'
            }
          ])

          const sites = await this.netlify.listSites({
            name: siteName,
            filter: 'all'
          })
          if (sites.length === 0) {
            this.error(`No sites found named ${siteName}`)
          }

          if (sites.length > 1) {
            const { siteName } = await inquirer.prompt([
              {
                type: 'list',
                name: 'name',
                paginated: true,
                choices: sites.map(site => site.name)
              }
            ])
            site = sites.find(site => (site.name = siteName))
            if (!site) this.error('No site selected')
          } else {
            site = sites[0]
          }
          break
        }
        case 'Site ID': {
          const { siteId } = await inquirer.prompt([
            {
              type: 'input',
              name: 'siteId',
              message: 'What is the site-id of the site?'
            }
          ])

          try {
            site = await this.netlify.getSite({ siteId })
          } catch (e) {
            if (e.status === 404) this.error(`Site id ${siteId} not found`)
            else this.error(e)
          }
          break
        }
      }
    }
    if (get(site, 'build_settings.repo_url')) {
      if (flags.force) {
        this.warn(
          `${get(site, 'name')} already configured to automatically deploy from ${get(site, 'build_settings.repo_url')}`
        )
      } else {
        this.error(
          `${get(site, 'name')} already configured to automatically deploy from ${get(
            site,
            'build_settings.repo_url'
          )}. Use --force to override`
        )
      }
    }
    return site
  }

  async configureManual(site) {
    const remoteUrl = await gitRemoteOriginUrl()

    if (!remoteUrl) this.error('CI requires a git remote.  No git remote found.')
    const parsedUrl = parseGitRemote(remoteUrl)
    const repoInfo = gitRepoInfo()

    const repo = {
      provider: 'manual',
      repo_path: parsedUrl.path,
      repo_branch: repoInfo.branch,
      allowed_branches: [repoInfo.branch]
    }

    const key = await this.netlify.createDeployKey()
    this.log('\nGive this Netlify SSH public key access to your repository:\n')
    this.log(`\n${key.public_key}\n\n`)
    const { sshKeyAdded } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'sshKeyAdded',
        message: 'Continue?',
        default: true
      }
    ])
    if (!sshKeyAdded) this.exit()

    repo.deploy_key_id = key.id

    // TODO: Look these up and default to the lookup order
    const { buildCmd, buildDir } = inquirer.prompt([
      {
        type: 'input',
        name: 'buildCmd',
        message: 'Your build command (hugo build/yarn run build/etc):',
        filter: val => (val === '' ? undefined : val)
      },
      {
        type: 'input',
        name: 'buildDir',
        message: 'Directory to deploy (blank for current dir):',
        default: '.'
      }
    ])
    repo.dir = buildDir
    if (buildCmd) repo.cmd = buildCmd

    site = this.netlify.updateSite({ siteId: site.id, body: { repo } })

    this.log('\nGive this Netlify SSH public key access to your repository:\n')
    this.log(`\n${site.deploy_hook}\n\n`)
    const { deployHookAdded } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'deployHookAdded',
        message: 'Continue?',
        default: true
      }
    ])
    if (!deployHookAdded) this.exit()
  }

  async configureGithub(site, repo) {
    throw new Error('Not implemented')
  }

  async configureGitlab(site, repo) {
    throw new Error('Not implemented')
  }

  async run() {
    const { flags } = this.parse(InitCommand)
    await this.authenticate()

    this.log('Configure continuous integration for a site')
    const site = await this.createOrFindSite()

    if (flags.manual) {
      await this.configureManual(site)
    } else {
      this.error('No configurator found for the git hosting service')
    }
  }
}

InitCommand.description = `${renderShortDesc('Configure continuous deployment')}`

InitCommand.flags = {
  manual: flags.boolean(),
  force: flags.boolean()
}

module.exports = InitCommand
