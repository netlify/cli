// @ts-check

const { createAddonsAuthCommand } = require('./addons-auth.cjs')
const { createAddonsConfigCommand } = require('./addons-config.cjs')
const { createAddonsCreateCommand } = require('./addons-create.cjs')
const { createAddonsDeleteCommand } = require('./addons-delete.cjs')
const { createAddonsListCommand } = require('./addons-list.cjs')

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
const createAddonsCommand = (program) => {
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
module.exports = { createAddonsCommand }
