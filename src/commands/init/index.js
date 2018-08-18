const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const SitesCreateCommand = require('../sites/create')
const { flags } = require('@oclif/command')
const inquirer = require('inquirer')

class InitCommand extends Command {
  async createOrFindSite() {
    const siteOpts = ['New site', 'Existing site']
    console.log(this.site.get('siteId'))
    if (this.site.get('siteId')) {
      try {
        const linkedSite = await this.netlify.getSite({ siteId: this.site.get('siteId') })
        siteOpts.unshift({
          name: `Linked site: ${linkedSite.name}`,
          value: 'Linked site'
        })
      } catch (_) {
        // noop
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
    let site
    if (configureOption === 'New site') {
      site = await SitesCreateCommand.run([])
    } else if (configureOption === 'Linked site') {
      site = await this.netlify.getSite({ siteId: this.site.get('siteId') })
    } else {
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
    }

    return site
  }

  async run() {
    await this.authenticate()
    //const siteId = this.site.get('siteId')

    //const remotes = [] // TODO parse remotes

    this.log('Configure continuous integration for a git remote')
    const site = await this.createOrFindSite()
    //this.site.set('siteId', site.id)
  }
}

InitCommand.description = `${renderShortDesc('Configure continuous deployment')}`

InitCommand.flags = {
  manual: flags.boolean()
}

module.exports = InitCommand
