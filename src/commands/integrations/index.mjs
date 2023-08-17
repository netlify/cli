import { createInitCommand } from './init.mjs'
import { createBuildCommand } from './build.mjs'
import { createPreviewCommand } from './preview.mjs'
import { createDevCommand } from './dev.mjs'
import {createDeployCommand} from './deploy.mjs'

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
  const integrationsCommand = program
  .command('integration')
  .alias('int')
  .description('Netlify integration commands')
  .action(integrations)

  createInitCommand(integrationsCommand)
  createBuildCommand(integrationsCommand)
  createPreviewCommand(integrationsCommand)
  createDevCommand(integrationsCommand)
  createDeployCommand(integrationsCommand)
  
  return integrationsCommand
}
