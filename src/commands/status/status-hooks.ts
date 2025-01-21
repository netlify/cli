import { OptionValues } from 'commander'
import prettyjson from 'prettyjson'

import { log } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'

export const statusHooks = async (options: OptionValues, command: BaseCommand) => {
  const { api, siteInfo } = command.netlify

  await command.authenticate()

  const ntlHooks = await api.listHooksBySiteId({ siteId: siteInfo.id })
  const data = {
    site: siteInfo.name,
    hooks: {},
  }

  ntlHooks.forEach((hook) => {
    // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    data.hooks[hook.id] = {
      type: hook.type,
      event: hook.event,
      id: hook.id,
      disabled: hook.disabled,
    }
    if (siteInfo.build_settings?.repo_url) {
      // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      data.hooks[hook.id].repo_url = siteInfo.build_settings.repo_url
    }
  })
  log(`─────────────────┐
Site Hook Status │
─────────────────┘`)
  log(prettyjson.render(data))
}
