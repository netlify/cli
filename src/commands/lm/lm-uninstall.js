// @ts-check
const { uninstall } = require('../../utils/lm/install')

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
const createLmUninstallCommand = (program) =>
  program
    .command('lm:uninstall', { hidden: true })
    .alias('lm:remove')
    .description(
      'Uninstalls Netlify git credentials helper and cleans up any related configuration changes made by the install command.',
    )
    .action(lmUninstall)

module.exports = { createLmUninstallCommand }
