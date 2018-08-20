const Command = require('../../base')
const { flags } = require('@oclif/command')
const renderShortDesc = require('../../utils/renderShortDescription')
const inquirer = require('inquirer')
const path = require('path')

class LinkCommand extends Command {
  async run() {
    await this.authenticate()
    const { flags } = this.parse(LinkCommand)
    const siteId = this.site.get('siteId')

    if (siteId && !flags.force) {
      let siteInaccessible = false
      let site
      try {
        site = await this.netlify.getSite({ siteId })
      } catch (e) {
        if (!e.ok) siteInaccessible = true
      }
      if (!siteInaccessible) {
        this.log(`Site already linked to ${site.name}`)
        this.log(`Link: ${site.admin_url}`)
        return this.exit()
      }
    }

    if (flags.id) {
      let site
      try {
        site = await this.netlify.getSite({ site_id: flags.id })
      } catch (e) {
        if (e.status === 404) this.error(new Error(`Site id ${flags.id} not found`))
        else this.error(e)
      }
      this.site.set('siteId', site.id)
      this.log(`Linked to ${site.name} in ${path.relative(path.join(process.cwd(), '..'), this.site.path)}`)
      return this.exit()
    }

    if (flags.name) {
      let results
      try {
        results = await this.netlify.listSites({
          name: flags.name,
          filter: 'all'
        })
      } catch (e) {
        if (e.status === 404) this.error(new Error(`${flags.name} not found`))
        else this.error(e)
      }

      if (results.length === 0) {
        this.error(new Error(`No sites found named ${flags.name}`))
      }
      const site = results[0]
      this.site.set('siteId', site.id)
      this.log(`Linked to ${site.name} in ${path.relative(path.join(process.cwd(), '..'), this.site.path)}`)
      return this.exit()
    }

    const { linkType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'linkType',
        message: 'How do you want to link this folder to a site?',
        choices: ['Site Name', 'Site ID']
      }
    ])

    switch (linkType) {
      case 'Site Name': {
        const { siteName } = await inquirer.prompt([
          {
            type: 'input',
            name: 'siteName',
            message: 'What is the name of the site?'
          }
        ])
        let sites
        try {
          sites = await this.netlify.listSites({
            name: siteName,
            filter: 'all'
          })
        } catch (e) {
          if (e.status === 404) this.error(`${siteName} not found`)
          else this.error(e)
        }

        if (sites.length === 0) {
          this.error(`No sites found named ${siteName}`)
        }
        let site
        if (sites.length > 1) {
          const { selectedSite } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedSite',
              paginated: true,
              choices: sites.map(site => ({ name: site.name, value: site }))
            }
          ])
          if (!selectedSite) this.error('No site selected')
          site = selectedSite
        } else {
          site = sites[0]
        }
        this.site.set('siteId', site.id)
        this.log(`Linked to ${site.name} in ${path.relative(path.join(process.cwd(), '..'), this.site.path)}`)
        this.exit()
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

        let site
        try {
          site = await this.netlify.getSite({ siteId })
        } catch (e) {
          if (e.status === 404) this.error(new Error(`Site id ${siteId} not found`))
          else this.error(e)
        }
        this.site.set('siteId', site.id)
        this.log(`Linked to ${site.name} in ${path.relative(path.join(process.cwd(), '..'), this.site.path)}`)
        this.exit()
        break
      }
    }
  }
}

LinkCommand.description = `${renderShortDesc('Link a local repo or project folder to an existing site on Netlify')}`

LinkCommand.examples = ['$ netlify init --id 123-123-123-123', '$ netlify init --name my-site-name']

LinkCommand.flags = {
  id: flags.string(),
  name: flags.string(),
  force: flags.boolean()
}

module.exports = LinkCommand
