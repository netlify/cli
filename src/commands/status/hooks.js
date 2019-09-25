const Command = require('../../utils/command')
const prettyjson = require('prettyjson')
const get = require('lodash.get')

class StatusHooksCommand extends Command {
  async run() {
    const { site, api } = this.netlify
    await this.authenticate()

    const siteId = site.id
    if (!siteId) {
      this.warn('Did you run `netlify link` yet?')
      this.error(`You don't appear to be in a folder that is linked to a site`)
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'status:hooks'
      }
    })

    let siteData
    try {
      siteData = await api.getSite({ siteId })
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

    const ntlHooks = await api.listHooksBySiteId({ siteId: siteData.id })
    const data = {
      site: siteData.name,
      hooks: {}
    }
    ntlHooks.forEach(hook => {
      data.hooks[hook.id] = {
        type: hook.type,
        event: hook.event,
        id: hook.id,
        disabled: hook.disabled
      }
      if (get(siteData, 'build_settings.repo_url')) {
        data.hooks[hook.id].repo_url = get(siteData, 'build_settings.repo_url')
      }
    })
    this.log(`─────────────────┐
Site Hook Status │
─────────────────┘`)
    this.log(prettyjson.render(data))
  }
}

StatusHooksCommand.description = `Print hook information of the linked site`

module.exports = StatusHooksCommand
