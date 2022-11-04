// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'uninstall'... Remove this comment to see the full error message
const { uninstall } = require('../../utils/lm/install.cjs')

/**
 * The lm:uninstall command
 */
const lmUninstall = async () => {
  await uninstall()
}

/**
 * Creates the `netlify lm:uninstall` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLmUn... Remove this comment to see the full error message
const createLmUninstallCommand = (program: $TSFixMe) => program
  .command('lm:uninstall', { hidden: true })
  .alias('lm:remove')
  .description(
    'Uninstalls Netlify git credentials helper and cleans up any related configuration changes made by the install command.',
  )
  .action(lmUninstall)

module.exports = { createLmUninstallCommand }
