/**
 * The lm command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const lm = async (options, command) => {
  console.log('lm command with options', options)
}

/**
 * Creates the `netlify lm` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createLmCommand = (program) =>
  program
    .command('lm')
    .description('Handle Netlify Large Media operations')
    .action(lm)

module.exports = { createLmCommand }
