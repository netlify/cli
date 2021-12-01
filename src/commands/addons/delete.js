// @ts-check
/**
 * The addons:delete command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
 const addonsDelete =  (options, command) => {
  console.log('addons:delete command with options', options, command.name())
}

/**
 * Creates the `netlify addons:delete` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createAddonsDeleteCommand = (program) =>
  program
  .command('addons:delete')
    .description('(Beta) Manage Netlify Add-ons')
    .action(addonsDelete)

module.exports = { createAddonsDeleteCommand }
