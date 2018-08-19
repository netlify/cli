const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const SitesCreateCommand = require('../sites/create')
const { flags } = require('@oclif/command')
const inquirer = require('inquirer')
const get = require('lodash.get')

class InitCommand extends Command {
  async createOrFindSite() {
    // TODO Encapsulate this better
    // Prompt existing site if not set up
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

      if (get(linkedSite, 'build_settings.repo_url')) {
        this.warn(`Folder linked to a site that already has CI`)
        this.error(
          `${get(linkedSite, 'name')} already configured to deploy from ${get(linkedSite, 'build_settings.repo_url')}`
        )
      }

      if (linkedSite) {
        siteOpts.unshift({
          name: `Linked site: ${linkedSite.name}`,
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

    // create site or search for one
    if (configureOption === 'New site') {
      return await SitesCreateCommand.run([])
    } else if (configureOption === 'linked-site') {
      return linkedSite
    } else {
      let site
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
            if (e.status === 404) this.error(new Error(`Site id ${siteId} not found`))
            else this.error(e)
          }
          break
        }
      }

      if (get(site, 'build_settings.repo_url')) {
        this.warn(`Folder linked to a site that already has CI`)
        this.error(`${get(site, 'name')} already configured to deploy from ${get(site, 'build_settings.repo_url')}`)
      }
      return site
    }
  }

  async run() {
    await this.authenticate()

    this.log('Configure continuous integration for a git remote')
    const site = await this.createOrFindSite()
    this.log(site)
    //this.site.set('siteId', site.id)
  }
}

InitCommand.description = `${renderShortDesc('Configure continuous deployment')}`

InitCommand.flags = {
  manual: flags.boolean()
  // force: flags.boolean()
}

module.exports = InitCommand
