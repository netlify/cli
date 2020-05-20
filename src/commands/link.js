const Command = require('../utils/command')
const { flags } = require('@oclif/command')
const path = require('path')
const chalk = require('chalk')
const { ensureNetlifyIgnore } = require('../utils/gitignore')
const linkPrompt = require('../utils/link/link-by-prompt')
const { track } = require('../utils/telemetry')

class LinkCommand extends Command {
  async run() {
    await this.authenticate()

    const { flags } = this.parse(LinkCommand)
    const { api, site, state } = this.netlify
    const siteId = site.id

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'link',
      },
    })

    let siteData
    try {
      siteData = await api.getSite({ siteId })
    } catch (e) {
      // silent api error
    }

    // Add .netlify to .gitignore file
    await ensureNetlifyIgnore(site.root)

    // Site id is incorrect
    if (siteId && !siteData) {
      console.log(`"${siteId}" was not found in your Netlify account.`)
      console.log(`Please double check your siteID and which account you are logged into via \`netlify status\`.`)
      return this.exit()
    }

    // If already linked to site. exit and prompt for unlink
    if (siteData) {
      this.log(`Site already linked to "${siteData.name}"`)
      this.log(`Admin url: ${siteData.admin_url}`)
      this.log()
      this.log(`To unlink this site, run: ${chalk.cyanBright('netlify unlink')}`)
      return this.exit()
    }

    if (flags.id) {
      try {
        siteData = await api.getSite({ site_id: flags.id })
      } catch (e) {
        if (e.status === 404) {
          this.error(new Error(`Site id ${flags.id} not found`))
        } else {
          this.error(e)
        }
      }

      // Save site ID
      state.set('siteId', siteData.id)
      this.log(`Linked to ${siteData.name} in ${state.path}`)

      await track('sites_linked', {
        siteId: siteData.id,
        linkType: 'manual',
        kind: 'byId',
      })

      return this.exit()
    }

    if (flags.name) {
      let results
      try {
        results = await api.listSites({
          name: flags.name,
          filter: 'all',
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
      siteData = results[0]
      state.set('siteId', siteData.id)

      this.log(`Linked to ${siteData.name} in ${path.relative(path.join(process.cwd(), '..'), state.path)}`)

      await track('sites_linked', {
        siteId: (siteData && siteData.id) || siteId,
        linkType: 'manual',
        kind: 'byName',
      })

      return this.exit()
    }

    siteData = await linkPrompt(this, flags)
    return siteData
  }
}

LinkCommand.description = `Link a local repo or project folder to an existing site on Netlify`

LinkCommand.examples = ['netlify link', 'netlify link --id 123-123-123-123', 'netlify link --name my-site-name']

LinkCommand.flags = {
  id: flags.string({
    description: 'ID of site to link to',
  }),
  name: flags.string({
    description: 'Name of site to link to',
  }),
  gitRemoteName: flags.string({
    description: 'Name of Git remote to use. e.g. "origin"',
  }),
}

module.exports = LinkCommand
