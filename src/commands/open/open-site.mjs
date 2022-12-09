import { error, exit, log, warn } from '../../utils/command-helpers.mjs'
import openBrowser from '../../utils/open-browser.mjs'

/**
 * The open:site command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
export const openSite = async (options, command) => {
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
    if (error_.status === 401) {
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
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createOpenSiteCommand = (program) =>
  program
    .command('open:site')
    .description('Opens current site url in browser')
    .addExamples(['netlify open:site'])
    .action(openSite)
