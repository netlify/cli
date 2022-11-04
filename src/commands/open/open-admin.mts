// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'error'.
const { error, exit, log, openBrowser, warn } = require('../../utils/index.mjs')

/**
 * The open:admin command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'openAdmin'... Remove this comment to see the full error message
const openAdmin = async (options: $TSFixMe, command: $TSFixMe) => {
  const { api, site } = command.netlify

  await command.authenticate()

  const siteId = site.id

  if (!siteId) {
    warn(`No Site ID found in current directory.
Run \`netlify link\` to connect to this folder to a site`)
    return false
  }

  let siteData
  try {
    siteData = await api.getSite({ siteId })
    log(`Opening "${siteData.name}" site admin UI:`)
    log(`> ${siteData.admin_url}`)
  } catch (error_) {
    // unauthorized
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if ((error_ as $TSFixMe).status === 401) {
      warn(`Log in with a different account or re-link to a site you have permission for`)
      error(`Not authorized to view the currently linked site (${siteId})`)
    }
    // site not found
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if ((error_ as $TSFixMe).status === 404) {
      log()
      log('Please double check this ID and verify you are logged in with the correct account')
      log()
      log('To fix this, run `netlify unlink` then `netlify link` to reconnect to the correct site ID')
      log()
      error(`Site "${siteId}" not found in account`)
    }
    error(error_)
  }

  await openBrowser({ url: siteData.admin_url })
  exit()
}

/**
 * Creates the `netlify open:admin` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createOpen... Remove this comment to see the full error message
const createOpenAdminCommand = (program: $TSFixMe) => program
  .command('open:admin')
  .description('Opens current site admin UI in Netlify')
  .addExamples(['netlify open:admin'])
  .action(openAdmin)

module.exports = { createOpenAdminCommand, openAdmin }
