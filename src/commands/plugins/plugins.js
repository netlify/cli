/**
 * The plugins command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const plugins = async (options, command) => {
  console.log('plugins command with options', options)
}

/**
 * Creates the `netlify plugins` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createPluginsCommand = (program) =>
  program
    .command('plugins')
    .description('list installed plugins')
    .action(plugins)

module.exports = { createPluginsCommand }
