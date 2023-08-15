import { createInitCommand } from './int-init.mjs'

/**
 * The int command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const integrations = (options, command) => {
  command.help()
}


/**
 * Creates the `netlify integration` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createIntCommand = (program) => {
  const integrationsCommand = program
  .command('integration')
  .alias('int')
  .description('Netlify integration commands')
  .action(integrations)

  createInitCommand(integrationsCommand)
  
  return integrationsCommand
}
