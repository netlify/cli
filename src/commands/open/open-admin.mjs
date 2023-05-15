import { exit, log } from '../../utils/command-helpers.mjs'
import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs'
import openBrowser from '../../utils/open-browser.mjs'

/**
 * The open:admin command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
export const openAdmin = async (options, command) => {
  const { siteInfo } = command.netlify

  await command.authenticate()

  log(`Opening "${siteInfo.name}" site admin UI:`)
  log(`> ${siteInfo.admin_url}`)

  await openBrowser({ url: siteInfo.admin_url })
  exit()
}

/**
 * Creates the `netlify open:admin` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createOpenAdminCommand = (program) =>
  program
    .command('open:admin')
    .description('Opens current site admin UI in Netlify')
    .addExamples(['netlify open:admin'])
    .hook('preAction', requiresSiteInfo)
    .action(openAdmin)
