// @ts-check
import { createLmInfoCommand } from './lm-info.mjs'
import { createLmInstallCommand } from './lm-install.mjs'
import { createLmSetupCommand } from './lm-setup.mjs'
import { createLmUninstallCommand } from './lm-uninstall.mjs'

/**
 * The lm command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const lm = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify lm` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createLmCommand = (program) => {
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
