// @ts-check
import { get } from 'dot-prop'
import prettyjson from 'prettyjson'

import { error, log, warn } from '../../utils/command-helpers.mjs'

/**
 * The status:hooks command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const statusHooks = async (options, command) => {
  const { api, site } = command.netlify

  await command.authenticate()

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

/**
 * Creates the `netlify status:hooks` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createStatusHooksCommand = (program) =>
  program.command('status:hooks').description('Print hook information of the linked site').action(statusHooks)
