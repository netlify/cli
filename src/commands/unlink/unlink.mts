// @ts-check


const { exit, log, track } = require('../../utils/index.mjs')

/**
 * The unlink command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */

const unlink = async (options: $TSFixMe, command: $TSFixMe) => {
  const { site, state } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log(`Folder is not linked to a Netlify site. Run 'netlify link' to link it`)
    return exit()
  }

  let siteData = {}
  try {
    siteData = await command.netlify.api.getSite({ siteId })
  } catch {
    // ignore errors if we can't get the site
  }

  state.delete('siteId')

  await track('sites_unlinked', {
    
    siteId: (siteData as $TSFixMe).id || siteId,
});

  if (site) {
    
    log(`Unlinked ${site.configPath} from ${siteData ? (siteData as $TSFixMe).name : siteId}`);
  } else {
    log('Unlinked site')
  }
}

/**
 * Creates the `netlify unlink` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */

export const createUnlinkCommand = (program: $TSFixMe) => program.command('unlink').description('Unlink a local folder from a Netlify site').action(unlink)

export default { createUnlinkCommand }
