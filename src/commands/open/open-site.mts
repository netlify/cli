// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'error'.
const { error, exit, log, openBrowser, warn } = require('../../utils/index.mjs')

/**
 * The open:site command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'openSite'.
const openSite = async (options: $TSFixMe, command: $TSFixMe) => {
  const { api, site } = command.netlify

  await command.authenticate()

  const siteId = site.id

  if (!siteId) {
    warn(`No Site ID found in current directory.
Run \`netlify link\` to connect to this folder to a site`)
    return false
  }

  let siteData
  let url
  try {
    siteData = await api.getSite({ siteId })
    url = siteData.ssl_url || siteData.url
    log(`Opening "${siteData.name}" site url:`)
    log(`> ${url}`)
  } catch (error_) {
    // unauthorized
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if ((error_ as $TSFixMe).status === 401) {
      warn(`Log in with a different account or re-link to a site you have permission for`)
      error(`Not authorized to view the currently linked site (${siteId})`)
    }
    error(error_)
  }

  await openBrowser({ url })
  exit()
}

/**
 * Creates the `netlify open:site` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createOpen... Remove this comment to see the full error message
const createOpenSiteCommand = (program: $TSFixMe) => program
  .command('open:site')
  .description('Opens current site url in browser')
  .addExamples(['netlify open:site'])
  .action(openSite)

module.exports = { createOpenSiteCommand, openSite }
