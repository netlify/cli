// @ts-check
import { installPlatform } from '../../utils/lm/install.js'
import { printBanner } from '../../utils/lm/ui.js'

/**
 * The lm:install command
 * @param {import('commander').OptionValues} options
 */
const lmInstall = async ({ force }) => {
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
export const createLmInstallCommand = (program) =>
  program
    .command('lm:install')
    .alias('lm:init')
    .description(
      `Configures your computer to use Netlify Large Media
It installs the required credentials helper for Git,
and configures your Git environment with the right credentials.`,
    )
    .option('-f, --force', 'Force the credentials helper installation')
    .action(lmInstall)
