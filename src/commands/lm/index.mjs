// @ts-check
import { createLmInfoCommand, createLmInstallCommand, createLmSetupCommand, createLmUninstallCommand } from './lm.mjs'

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
    .command('lm', { hidden: true })
    .description(
      '[Deprecated and will be removed from future versions] Handle Netlify Large Media operations\nThe lm command will help you manage large media for a site',
    )
    .addExamples(['netlify lm:info', 'netlify lm:install', 'netlify lm:setup'])
    .action(lm)
}
