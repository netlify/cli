/**
 * The addons command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const addons = async (options, command) => {
  console.log('addons command with options', options)
}

/**
 * Creates the `netlify addons` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createAddonsCommand = (program) =>
  program
    .command('addons')
    .description('(Beta) Manage Netlify Add-ons')
    .action(addons)

module.exports = { createAddonsCommand }
