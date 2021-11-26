/**
 * The watch command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const watch = async (options, command) => {
  console.log('watch command with options', options)
}

/**
 * Creates the `netlify watch` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createWatchCommand = (program) =>
  program
    .command('watch')
    .description('Watch for site deploy to finish')
    .action(watch)

module.exports = { createWatchCommand }
