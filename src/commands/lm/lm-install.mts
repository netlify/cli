// @ts-check

const { installPlatform } = require('../../utils/lm/install.mjs')

const { printBanner } = require('../../utils/lm/ui.mjs')

/**
 * The lm:install command
 * @param {import('commander').OptionValues} options
 */
const lmInstall = async ({
  force

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

export default { createLmInstallCommand }
