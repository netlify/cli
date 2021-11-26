/**
 * The unlink command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const unlink = async (options, command) => {
  console.log('unlink command with options', options)
}

/**
 * Creates the `netlify unlink` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createUnlinkCommand = (program) =>
  program
    .command('unlink')
    .description('Unlink a local folder from a Netlify site')
    .action(unlink)

module.exports = { createUnlinkCommand }
