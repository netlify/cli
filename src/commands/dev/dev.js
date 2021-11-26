/**
 * The dev command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const dev = async (options, command) => {
  console.log('dev command with options', options)
}

/**
 * Creates the `netlify dev` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createDevCommand = (program) =>
  program
    .command('dev')
    .description('Local dev server')
    .action(dev)

module.exports = { createDevCommand }
