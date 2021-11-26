/**
 * The functions command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const functions = async (options, command) => {
  console.log('functions command with options', options)
}

/**
 * Creates the `netlify functions` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createFunctionsCommand = (program) =>
  program
    .command('functions')
    .description('Manage netlify functions')
    .action(functions)

module.exports = { createFunctionsCommand }
