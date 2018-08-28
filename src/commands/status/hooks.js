const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const prettyjson = require('prettyjson')
const get = require('lodash.get')

class StatusHooksCommand extends Command {
  async run() {
    const accessToken = this.global.get('accessToken')
    const siteId = this.site.get('siteId')

    if (!accessToken) {
      this.error(`Not logged in. Log in to see site status.`)
    }

    if (!siteId) {
      this.warn('Did you run `netlify link` yet?')
      this.error(`You don't appear to be in a folder that is linked to a site`)
    }

    let site
    try {
      site = await this.netlify.getSite({ siteId })
    } catch (e) {
      if (e.status === 401 /* unauthorized*/) {
        this.warn(`Log in with a different account or re-link to a site you have permission for`)
        this.error(`Not authorized to view the currently linked site (${siteId})`)
      }
      if (e.status === 404 /* missing */) {
        this.error(`The site this folder is linked to can't be found`)
      }
      this.error(e)
    }

    const ntlHooks = await this.netlify.listHooksBySiteId({ siteId: site.id })
    const data = {
      site: site.name,
      hooks: {}
    }
    ntlHooks.forEach(hook => {
      data.hooks[hook.id] = {
        type: hook.type,
        event: hook.event,
        id: hook.id,
        disabled: hook.disabled
      }
      if (get(site, 'build_settings.repo_url')) data.hooks[hook.id].repo_url = get(site, 'build_settings.repo_url')
    })
    this.log(`─────────────────┐
Site Hook Status │
─────────────────┘`)
    this.log(prettyjson.render(data))
  }
}

StatusHooksCommand.description = `${renderShortDesc('Print hook information of the linked site')}`

module.exports = StatusHooksCommand
