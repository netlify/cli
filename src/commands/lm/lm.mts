// @ts-check

const { createLmInfoCommand } = require('./lm-info.mjs')

const { createLmInstallCommand } = require('./lm-install.mjs')

const { createLmSetupCommand } = require('./lm-setup.mjs')

const { createLmUninstallCommand } = require('./lm-uninstall.mjs')

/**
 * The lm command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */

const lm = (options: $TSFixMe, command: $TSFixMe) => {
  command.help()
}

/**
 * Creates the `netlify lm` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */

export const createLmCommand = (program: $TSFixMe) => {
  createLmInfoCommand(program)
  createLmInstallCommand(program)
  createLmSetupCommand(program)
  createLmUninstallCommand(program)

  program
    .command('lm')
    .description('Handle Netlify Large Media operations\nThe lm command will help you manage large media for a site')
    .addExamples(['netlify lm:info', 'netlify lm:install', 'netlify lm:setup'])
    .action(lm)
}

export default { createLmCommand }
