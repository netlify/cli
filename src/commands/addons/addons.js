// @ts-check

import { createAddonsAuthCommand } from './addons-auth.js'
import { createAddonsConfigCommand } from './addons-config.js'
import { createAddonsCreateCommand } from './addons-create.js'
import { createAddonsDeleteCommand } from './addons-delete.js'
import { createAddonsListCommand } from './addons-list.js'

/**
 * The addons command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const addons = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify addons` command
 * @param {import('../base-command').BaseCommand} program
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
    .noHelpOptions()
    .addExamples([
      'netlify addons:create addon-xyz',
      'netlify addons:list',
      'netlify addons:config addon-xyz',
      'netlify addons:delete addon-xyz',
      'netlify addons:auth addon-xyz',
    ])
    .action(addons)
}
