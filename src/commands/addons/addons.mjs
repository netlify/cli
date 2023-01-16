// @ts-check
import { createAddonsAuthCommand } from './addons-auth.mjs'
import { createAddonsConfigCommand } from './addons-config.mjs'
import { createAddonsCreateCommand } from './addons-create.mjs'
import { createAddonsDeleteCommand } from './addons-delete.mjs'
import { createAddonsListCommand } from './addons-list.mjs'

/**
 * The addons command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const addons = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify addons` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createAddonsCommand = (program) => {
  createAddonsAuthCommand(program)
  createAddonsConfigCommand(program)
  createAddonsCreateCommand(program)
  createAddonsDeleteCommand(program)
  createAddonsListCommand(program)

  return program
    .command('addons')
    .alias('addon')
    .description('(Beta) Manage Netlify Add-ons')
    .addExamples([
      'netlify addons:create addon-xyz',
      'netlify addons:list',
      'netlify addons:config addon-xyz',
      'netlify addons:delete addon-xyz',
      'netlify addons:auth addon-xyz',
    ])
    .action(addons)
}
