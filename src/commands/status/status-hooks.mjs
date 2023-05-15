// @ts-check
import prettyjson from 'prettyjson'

import { log } from '../../utils/command-helpers.mjs'
import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs'

/**
 * The status:hooks command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const statusHooks = async (options, command) => {
  const { api, siteInfo } = command.netlify

  await command.authenticate()

  const ntlHooks = await api.listHooksBySiteId({ siteId: siteInfo.id })
  const data = {
    site: siteInfo.name,
    hooks: {},
  }
  ntlHooks.forEach((hook) => {
    data.hooks[hook.id] = {
      type: hook.type,
      event: hook.event,
      id: hook.id,
      disabled: hook.disabled,
    }
    if (siteInfo.build_settings?.repo_url) {
      data.hooks[hook.id].repo_url = siteInfo.build_settings.repo_url
    }
  })
  log(`─────────────────┐
Site Hook Status │
─────────────────┘`)
  log(prettyjson.render(data))
}

/**
 * Creates the `netlify status:hooks` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createStatusHooksCommand = (program) =>
  program
    .command('status:hooks')
    .description('Print hook information of the linked site')
    .hook('preAction', requiresSiteInfo)
    .action(statusHooks)
