import { exit, log } from '../../utils/command-helpers.mjs'
import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs'
import openBrowser from '../../utils/open-browser.mjs'

/**
 * The open:site command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
export const openSite = async (options, command) => {
  const { siteInfo } = command.netlify

  await command.authenticate()

  const url = siteInfo.ssl_url || siteInfo.url
  log(`Opening "${siteInfo.name}" site url:`)
  log(`> ${url}`)

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
    .hook('preAction', requiresSiteInfo)
    .action(openSite)
