/**
 * The sites command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const sites = async (options, command) => {
  console.log('sites command with options', options)
}

/**
 * Creates the `netlify sites` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createSitesCommand = (program) =>
  program
    .command('sites')
    .description('Handle various site operations')
    .action(sites)

module.exports = { createSitesCommand }
