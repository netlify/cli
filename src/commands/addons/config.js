// @ts-check
/**
 * The addons:config command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
 const addonsConfig = async (options, command) => {
  console.log('addons:config command with options', options)
}

/**
 * Creates the `netlify addons:config` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createAddonsConfigCommand = (program) =>
  program
    .command('addons:config')
    .description('(Beta) Manage Netlify Add-ons')
    .action(addonsConfig)

module.exports = { createAddonsConfigCommand }
