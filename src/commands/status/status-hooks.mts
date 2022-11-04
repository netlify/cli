// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'get'.
const { get } = require('dot-prop')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'prettyjson... Remove this comment to see the full error message
const prettyjson = require('prettyjson')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'error'.
const { error, log, warn } = require('../../utils/index.mjs')

/**
 * The status:hooks command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const statusHooks = async (options: $TSFixMe, command: $TSFixMe) => {
  const { api, site } = command.netlify

  await command.authenticate()

  const siteId = site.id
  if (!siteId) {
    warn('Did you run `netlify link` yet?')
    error(`You don't appear to be in a folder that is linked to a site`)
  }

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  let siteData: $TSFixMe
  try {
    siteData = await api.getSite({ siteId })
  } catch (error_) {
    // unauthorized
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if ((error_ as $TSFixMe).status === 401) {
      warn(`Log in with a different account or re-link to a site you have permission for`)
      error(`Not authorized to view the currently linked site (${siteId})`)
    }
    // missing
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if ((error_ as $TSFixMe).status === 404) {
      error(`The site this folder is linked to can't be found`)
    }
    error(error_)
  }

  const ntlHooks = await api.listHooksBySiteId({ siteId: siteData.id })
  const data = {
    site: siteData.name,
    hooks: {},
  }
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  ntlHooks.forEach((hook: $TSFixMe) => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    data.hooks[hook.id] = {
      type: hook.type,
      event: hook.event,
      id: hook.id,
      disabled: hook.disabled,
    }
    if (get(siteData, 'build_settings.repo_url')) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createStat... Remove this comment to see the full error message
const createStatusHooksCommand = (program: $TSFixMe) => program.command('status:hooks').description('Print hook information of the linked site').action(statusHooks)

module.exports = { createStatusHooksCommand }
