import { createBuildCommand } from './build.mjs'
import { createDeployCommand } from './deploy.mjs'
import { createDevCommand } from './dev.mjs'
import { createPreviewCommand } from './preview.mjs'

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
  createBuildCommand(program)
  createPreviewCommand(program)
  createDevCommand(program)
  createDeployCommand(program)

  return program.command('integration').alias('int').description('Manage integrations').action(integrations)
}
