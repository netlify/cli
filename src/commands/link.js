const Command = require('../base')
const { flags } = require('@oclif/command')
const renderShortDesc = require('../utils/renderShortDescription')
const inquirer = require('inquirer')
const path = require('path')
const chalk = require('chalk')
const getRepoData = require('../utils/getRepoData')
const linkPrompt = require('../utils/link/link-by-prompt')
const isEmpty = require('lodash.isempty')

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
        if (!e.ok) {
          siteInaccessible = true
        }
      }
      if (!siteInaccessible) {
        this.log(`Site already linked to ${site.name}`)
        this.log(`Link: ${site.admin_url}`)
        this.log()
        this.log(`To unlink this site, run: \`netlify unlink\``)
        return this.exit()
      }
    }

    if (flags.id) {
      let site
      try {
        site = await this.netlify.getSite({ site_id: flags.id })
      } catch (e) {
        if (e.status === 404) {
          this.error(new Error(`Site id ${flags.id} not found`))
        }
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

    await linkPrompt(this)
  }
}

LinkCommand.description = `${renderShortDesc('Link a local repo or project folder to an existing site on Netlify')}`

LinkCommand.examples = [
  '$ netlify init --id 123-123-123-123',
  '$ netlify init --name my-site-name'
]

LinkCommand.flags = {
  id: flags.string({
    description: 'ID of site to link to'
  }),
  name: flags.string({
    description: 'Name of site to link to'
  }),
  force: flags.boolean({
    description: 'Force link a folder to a site, even if the folder is already linked'
  })
}

module.exports = LinkCommand
