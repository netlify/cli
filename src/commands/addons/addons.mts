
import { OptionValues } from 'commander'

import BaseCommand from '../base-command.mjs'

import { createAddonsCreateCommand } from './addons-create.mjs'
import { createAddonsDeleteCommand } from './addons-delete.mjs'
import { createAddonsListCommand } from './addons-list.mjs'


const addons = (options: OptionValues, command: BaseCommand) => {
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

  program
  .command('addons:config', { hidden: true })
  .alias('addon:config')
  .argument('<name>', 'Add-on namespace')
  .description('Configure add-on settings')
  // allow for any flags. Handy for variadic configuration options
  .allowUnknownOption(true)
  // @ts-expect-error TS(7006) FIXME: Parameter 'addonName' implicitly has an 'any' type... Remove this comment to see the full error message
  .action(async (addonName, options, command) => {
    const { addonsConfig } = await import('./addons-config.mjs')
    await addonsConfig(addonName, options, command)
  })

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
