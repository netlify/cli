import { createAddonsAuthCommand } from './addons-auth.js'
import { createAddonsConfigCommand } from './addons-config.js'
import { createAddonsCreateCommand } from './addons-create.js'
import { createAddonsDeleteCommand } from './addons-delete.js'
import { createAddonsListCommand } from './addons-list.js'

/**
 * The addons command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.js').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const addons = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify addons` command
 * @param {import('../base-command.js').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createAddonsCommand = (program) => {
  createAddonsAuthCommand(program)
  createAddonsConfigCommand(program)
  createAddonsCreateCommand(program)
  createAddonsDeleteCommand(program)
  createAddonsListCommand(program)

  return program
    .command('addons', { hidden: true })
    .alias('addon')
    .description('[Deprecated and will be removed from future versions] Manage Netlify Add-ons')
    .addExamples([
      'netlify addons:create addon-xyz',
      'netlify addons:list',
      'netlify addons:config addon-xyz',
      'netlify addons:delete addon-xyz',
      'netlify addons:auth addon-xyz',
    ])
    .action(addons)
}
