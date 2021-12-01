/**
 * The completion command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const completion = (options, command) => {
  console.log('completion command with options',options, command.name())
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
