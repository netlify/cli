import { createInitCommand } from './int-init.mjs'
import { createBuildCommand } from './int-build.mjs'
import { createPreviewCommand } from './int-preview.mjs'
import { createDevCommand } from './int-dev.mjs'

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
  createBuildCommand(integrationsCommand)
  createPreviewCommand(integrationsCommand)
  createDevCommand(integrationsCommand)
  
  return integrationsCommand
}
