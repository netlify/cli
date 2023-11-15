// @ts-check
/**
 * Creates the `netlify lm:info` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createLmInfoCommand = (program) =>
  program
    .command('lm:info', { hidden: true })
    .description('Show large media requirements information.')
    .action(async () => {
      const { lmInfo } = await import('./lm-info.mjs')
      await lmInfo()
    })

/**
 * Creates the `netlify lm:install` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createLmInstallCommand = (program) =>
  program
    .command('lm:install', { hidden: true })
    .alias('lm:init')
    .description(
      `Configures your computer to use Netlify Large Media
It installs the required credentials helper for Git,
and configures your Git environment with the right credentials.`,
    )
    .option('-f, --force', 'Force the credentials helper installation')
    .action(async ({ force }) => {
      const { lmInstall } = await import('./lm-install.mjs')
      await lmInstall({ force })
    })

/**
 * Creates the `netlify lm:setup` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createLmSetupCommand = (program) =>
  program
    .command('lm:setup', { hidden: true })
    .description('Configures your site to use Netlify Large Media')
    .option('-s, --skip-install', 'Skip the credentials helper installation check')
    .option('-f, --force-install', 'Force the credentials helper installation')
    .addHelpText('after', 'It runs the install command if you have not installed the dependencies yet.')
    .action(async (options, command) => {
      const { lmSetup } = await import('./lm-setup.mjs')
      await lmSetup(options, command)
    })

/**
 * Creates the `netlify lm:uninstall` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createLmUninstallCommand = (program) =>
  program
    .command('lm:uninstall', { hidden: true })
    .alias('lm:remove')
    .description(
      'Uninstalls Netlify git credentials helper and cleans up any related configuration changes made by the install command.',
    )
    .action(async () => {
      const { lmUninstall } = await import('./lm-uninstall.mjs')
      await lmUninstall()
    })
