
import { createAddonsConfigCommand } from './addons-config.mjs'
import { createAddonsCreateCommand } from './addons-create.mjs'
import { createAddonsDeleteCommand } from './addons-delete.mjs'
import { createAddonsListCommand } from './addons-list.mjs'

/**
 * The addons command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const addons = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify addons` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createAddonsCommand = (program) => {
  program
  .command('addons:auth', { hidden: true })
  .alias('addon:auth')
  .argument('<name>', 'Add-on slug')
  .description('Login to add-on provider')
  // @ts-expect-error TS(7006) FIXME: Parameter 'addonName' implicitly has an 'any' type... Remove this comment to see the full error message
  .action(async (addonName, options, command) => {
    const { addonsAuth } = await import('./addons-auth.mjs')
    await addonsAuth(addonName, options, command)
  })
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
