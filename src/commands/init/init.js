/**
 * The init command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const init = async (options, command) => {
  console.log('init command with options', options)
}

/**
 * Creates the `netlify init` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createInitCommand = (program) =>
  program
    .command('init')
    .description('Configure continuous deployment for a new or existing site. To create a new site without continuous deployment, use `netlify sites:create`')
    .action(init)

module.exports = { createInitCommand }
