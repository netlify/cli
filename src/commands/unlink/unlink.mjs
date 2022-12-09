// @ts-check
import { exit, log } from '../../utils/command-helpers.mjs'
import { track } from '../../utils/telemetry/index.mjs'

/**
 * The unlink command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const unlink = async (options, command) => {
  const { site, state } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log(`Folder is not linked to a Netlify site. Run 'netlify link' to link it`)
    return exit()
  }

  let siteData = {}
  try {
    // @ts-ignore types from API are wrong they cannot recognize `getSite` of API
    siteData = await command.netlify.api.getSite({ siteId })
  } catch {
    // ignore errors if we can't get the site
  }

  state.delete('siteId')

  await track('sites_unlinked', {
    siteId: siteData.id || siteId,
  })

  if (site) {
    log(`Unlinked ${site.configPath} from ${siteData ? siteData.name : siteId}`)
  } else {
    log('Unlinked site')
  }
}

/**
 * Creates the `netlify unlink` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createUnlinkCommand = (program) =>
  program.command('unlink').description('Unlink a local folder from a Netlify site').action(unlink)
