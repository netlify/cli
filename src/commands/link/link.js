/**
 * The link command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const link = async (options, command) => {
  console.log('link command with options', options)
}

/**
 * Creates the `netlify link` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createLinkCommand = (program) =>
  program
    .command('link')
    .description('Link a local repo or project folder to an existing site on Netlify')
    .action(link)

module.exports = { createLinkCommand }
