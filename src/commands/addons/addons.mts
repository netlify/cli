// @ts-check


const { createAddonsAuthCommand } = require('./addons-auth.mjs')

const { createAddonsConfigCommand } = require('./addons-config.mjs')

const { createAddonsCreateCommand } = require('./addons-create.mjs')

const { createAddonsDeleteCommand } = require('./addons-delete.mjs')

const { createAddonsListCommand } = require('./addons-list.mjs')

/**
 * The addons command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */

const addons = (options: $TSFixMe, command: $TSFixMe) => {
  command.help()
}

/**
 * Creates the `netlify addons` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */

export const createAddonsCommand = (program: $TSFixMe) => {
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
export default { createAddonsCommand }
