import { createDeployCommand } from './deploy.mjs'

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
export const createIntegrationCommand = (program) => {
  createDeployCommand(program)

  return program
    .command('integration')
    .alias('int')
    .description('Manage Netlify Integrations built with the Netlify SDK')
    .action(integrations)
}
