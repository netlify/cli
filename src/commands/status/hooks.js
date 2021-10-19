const { get } = require('dot-prop')
const prettyjson = require('prettyjson')

const Command = require('../../utils/command')
const { error, log, warn } = require('../../utils/command-helpers')

class StatusHooksCommand extends Command {
  async run() {
    const { api, site } = this.netlify

    await this.authenticate()

    const siteId = site.id
    if (!siteId) {
      warn('Did you run `netlify link` yet?')
      error(`You don't appear to be in a folder that is linked to a site`)
    }

    let siteData
    try {
      siteData = await api.getSite({ siteId })
    } catch (error_) {
      // unauthorized
      if (error_.status === 401) {
        warn(`Log in with a different account or re-link to a site you have permission for`)
        error(`Not authorized to view the currently linked site (${siteId})`)
      }
      // missing
      if (error_.status === 404) {
        error(`The site this folder is linked to can't be found`)
      }
      error(error_)
    }

    const ntlHooks = await api.listHooksBySiteId({ siteId: siteData.id })
    const data = {
      site: siteData.name,
      hooks: {},
    }
    ntlHooks.forEach((hook) => {
      data.hooks[hook.id] = {
        type: hook.type,
        event: hook.event,
        id: hook.id,
        disabled: hook.disabled,
      }
      if (get(siteData, 'build_settings.repo_url')) {
        data.hooks[hook.id].repo_url = get(siteData, 'build_settings.repo_url')
      }
    })
    log(`─────────────────┐
Site Hook Status │
─────────────────┘`)
    log(prettyjson.render(data))
  }
}

StatusHooksCommand.description = `Print hook information of the linked site`

module.exports = StatusHooksCommand
