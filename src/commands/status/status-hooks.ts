import prettyjson from 'prettyjson'

import { log } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'
import type { StatusHooksOptionValues } from './option_values.js'

interface StatusHook {
  type: string | undefined
  event: string | undefined
  id: string
  disabled: boolean
  repo_url?: string
}

export const statusHooks = async (_options: StatusHooksOptionValues, command: BaseCommand): Promise<void> => {
  const { api, siteInfo } = command.netlify

  await command.authenticate()

  const ntlHooks = await api.listHooksBySiteId({ siteId: siteInfo.id })
  const hooks: Record<string, StatusHook> = {}

  ntlHooks.forEach((hook) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- FIXME(@netlify/api): `listHooksBySiteId` marks `id` as optional
    const id = hook.id!
    hooks[id] = {
      type: hook.type,
      event: hook.event,
      id,
      disabled: hook.disabled ?? false,
    }
    if (siteInfo.build_settings?.repo_url) {
      hooks[id].repo_url = siteInfo.build_settings.repo_url
    }
  })
  const data = { project: siteInfo.name, hooks }
  log(`─────────────────┐
Project Hook Status │
─────────────────┘`)
  log(prettyjson.render(data))
}
