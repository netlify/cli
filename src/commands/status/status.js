/**
 * The status command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const status = async (options, command) => {
  console.log('status command with options', options)
}

/**
 * Creates the `netlify status` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createStatusCommand = (program) =>
  program
    .command('status')
    .description('Print status information')
    .option('--verbose', 'Output system info', false)
    .action(status)

module.exports = { createStatusCommand }
