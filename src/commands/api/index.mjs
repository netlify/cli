import { chalk } from '../../utils/command-helpers.mjs'

/**
 * Creates the `netlify api` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */

export const createApiCommand = (program) =>
  program
    .command('api')
    .argument('[apiMethod]', 'Open API method to run')
    .description(
      `Run any Netlify API method
For more information on available methods checkout https://open-api.netlify.com/ or run '${chalk.grey(
        'netlify api --list',
      )}'`,
    )
    .option('-d, --data <data>', 'Data to use')
    .option('--list', 'List out available API methods', false)
    .addExamples(['netlify api --list', `netlify api getSite --data '{ "site_id": "123456" }'`])
    .action(async (apiMethod, options, command) => {
      const { apiCommand } = await import('./api.mjs')
      await apiCommand(apiMethod, options, command)
    })
