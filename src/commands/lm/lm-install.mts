// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'installPla... Remove this comment to see the full error message
const { installPlatform } = require('../../utils/lm/install.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'printBanne... Remove this comment to see the full error message
const { printBanner } = require('../../utils/lm/ui.cjs')

/**
 * The lm:install command
 * @param {import('commander').OptionValues} options
 */
const lmInstall = async ({
  force
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const installed = await installPlatform({ force })
  if (installed) {
    printBanner(force)
  }
}

/**
 * Creates the `netlify lm:install` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLmIn... Remove this comment to see the full error message
const createLmInstallCommand = (program: $TSFixMe) => program
  .command('lm:install')
  .alias('lm:init')
  .description(
    `Configures your computer to use Netlify Large Media
It installs the required credentials helper for Git,
and configures your Git environment with the right credentials.`,
  )
  .option('-f, --force', 'Force the credentials helper installation')
  .action(lmInstall)

module.exports = { createLmInstallCommand }
