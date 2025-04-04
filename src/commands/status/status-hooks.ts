import type { OptionValues } from 'commander'
import prettyjson from 'prettyjson'

import { log } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'

interface StatusHook {
  type: string | undefined
  event: string | undefined
  id: string
  disabled: boolean
  repo_url?: string
}

export const statusHooks = async (_options: OptionValues, command: BaseCommand): Promise<void> => {
  const { api, siteInfo } = command.netlify

  await command.authenticate()

  const ntlHooks = await api.listHooksBySiteId({ siteId: siteInfo.id })
  const data = {
    site: siteInfo.name,
    hooks: {} as Record<string, StatusHook>,
  }

  ntlHooks.forEach((hook) => {
    // TODO(serhalp) Surely the `listHooksBySiteId` type is wrong about `id` being optional. Fix.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const id = hook.id!
    data.hooks[id] = {
      type: hook.type,
      event: hook.event,
      id,
      disabled: hook.disabled ?? false,
    }
    if (siteInfo.build_settings?.repo_url) {
      data.hooks[id].repo_url = siteInfo.build_settings.repo_url
    }
  })
  log(`─────────────────┐
Site Hook Status │
─────────────────┘`)
  log(prettyjson.render(data))
}
