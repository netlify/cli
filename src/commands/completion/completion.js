/**
 * The completion command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const completion = async (options, command) => {
  console.log('completion command with options', options)
}

/**
 * Creates the `netlify completion` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createCompletionCommand = (program) =>
  program
    .command('completion')
    .description('(Beta) Generate shell completion script')
    .action(completion)

module.exports = { createCompletionCommand }
