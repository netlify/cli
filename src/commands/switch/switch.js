/**
 * The switch command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const switchCommand = async (options, command) => {
  console.log('switch command with options', options)
}

/**
 * Creates the `netlify switch` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createSwitchCommand = (program) =>
  program
    .command('switch')
    .description('Switch your active Netlify account')
    .action(switchCommand)

module.exports = { createSwitchCommand }
