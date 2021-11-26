const chalk = require('chalk')
/**
 * The api command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const api = async (options, command) => {
  console.log('api command with options', options)
}

/**
 * Creates the `netlify api` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createApiCommand = (program) =>
  program
    .command('api')
    .description('Run any Netlify API method')
    .option('-d, --data', 'Data to use')
    .option('--list', 'List out available API methods', false)
    .addHelpText(
      'after',
      `
${chalk.bold('DESCRIPTION')}
  For more information on available methods checkout https://open-api.netlify.com/ or run "netlify api --list"

${chalk.bold('EXAMPLES')}
  $ netlify api --list
  $ netlify api getSite --data '{ "site_id": "123456"}'
    `,
    )
    .action(api)

module.exports = { createApiCommand }
