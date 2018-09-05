const Command = require('../base')
const { flags } = require('@oclif/command')
const renderShortDesc = require('../utils/renderShortDescription')
const path = require('path')
const chalk = require('chalk')
const linkPrompt = require('../utils/link/link-by-prompt')


class LinkCommand extends Command {
  async run() {
    await this.authenticate()
    const { flags } = this.parse(LinkCommand)
    const siteId = this.site.get('siteId')
    // const hasFlags = !isEmpty(flags)
    let site
    try {
      site = await this.netlify.getSite({ siteId })
    } catch (e) {
      // silent api error
    }

    // Site id is incorrect
    if (siteId && !site) {
      console.log(`No site "${siteId}" found in your netlify account.`)
      console.log(`Please double check your siteID and which account you are logged into via \`netlify status\`.`)
      return this.exit()
    }

    // If already linked to site. exit and prompt for unlink
    if (site) {
      this.log(`Site already linked to "${site.name}"`)
      this.log(`Admin url: ${site.admin_url}`)
      this.log()
      this.log(`To unlink this site, run: ${chalk.cyanBright('netlify unlink')}`)
      return this.exit()
    }

    if (flags.id) {
      try {
        site = await this.netlify.getSite({ site_id: flags.id })
      } catch (e) {
        if (e.status === 404) {
          this.error(new Error(`Site id ${flags.id} not found`))
        } else {
          this.error(e)
        }
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
        if (e.status === 404) {
          this.error(new Error(`${flags.name} not found`))
        } else {
          this.error(e)
        }
      }

      if (results.length === 0) {
        this.error(new Error(`No sites found named ${flags.name}`))
      }
      const site = results[0]
      this.site.set('siteId', site.id)
      this.log(`Linked to ${site.name} in ${path.relative(path.join(process.cwd(), '..'), this.site.path)}`)
      return this.exit()
    }

    site = await linkPrompt(this)
    return site
  }
}

LinkCommand.description = `${renderShortDesc('Link a local repo or project folder to an existing site on Netlify')}`

LinkCommand.examples = [
  'netlify link',
  'netlify link --id 123-123-123-123',
  'netlify link --name my-site-name'
]

LinkCommand.flags = {
  id: flags.string({
    description: 'ID of site to link to'
  }),
  name: flags.string({
    description: 'Name of site to link to'
  })
}

module.exports = LinkCommand
