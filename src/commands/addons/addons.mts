
import { OptionValues } from 'commander'

import BaseCommand from '../base-command.mjs'

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
  .action(async (addonName, options, command) => {
    const { addonsConfig } = await import('./addons-config.mjs')
    await addonsConfig(addonName, options, command)
  })

  program
  .command('addons:create', { hidden: true })
  .alias('addon:create')
  .argument('<name>', 'Add-on namespace')
  .description(
    `Add an add-on extension to your site
Add-ons are a way to extend the functionality of your Netlify site`,
  )
  // allow for any flags. Handy for variadic configuration options
  .allowUnknownOption(true)
  .action(async (addonName, options, command) => {
    const { addonsCreate } = await import('./addons-create.mjs')
    await addonsCreate(addonName, options, command)
  })

  program
  .command('addons:delete', { hidden: true })
  .alias('addon:delete')
  .argument('<name>', 'Add-on namespace')
  .description(
    `Remove an add-on extension to your site\nAdd-ons are a way to extend the functionality of your Netlify site`,
  )
  .option('-f, --force', 'delete without prompting (useful for CI)')
  .action(async (addonName, options, command) => {
    const { addonsDelete } = await import('./addons-delete.mjs')
    await addonsDelete(addonName, options, command)
  })


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
