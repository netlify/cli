// @ts-check

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'exit'.
const { exit, log, track } = require('../../utils/index.mjs')

/**
 * The unlink command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
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
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    siteId: (siteData as $TSFixMe).id || siteId,
});

  if (site) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
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
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createUnli... Remove this comment to see the full error message
const createUnlinkCommand = (program: $TSFixMe) => program.command('unlink').description('Unlink a local folder from a Netlify site').action(unlink)

module.exports = { createUnlinkCommand }
