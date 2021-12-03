// @ts-check
const process = require('process')

const { runProcess } = require('../../utils')

/**
 * The dev:trace command
 * @returns {Promise<void>}
 */
const devTrace = async () => {
  const args = ['trace', ...process.argv.slice(3)]
  const { subprocess } = runProcess({ args })
  await subprocess
}

/**
 * Creates the `netlify dev:trace` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createDevTraceCommand = (program) =>
  program
    .command('dev:trace')
    .argument('<url>', 'Sets the request URL')
    .description('Trace command')
    .option('-X, --request <method>', 'Specifies a custom request method [default: GET]')
    .option('-b, --cookie <cookie>', 'Request cookie, this flag can be used multiple times. Example: "nf_jwt=token"')
    .option(
      '-H, --header <header>',
      'Request header, this flag can be used multiple times. Example: "Host: netlify.test"',
    )
    .option('-w, --watch <path>', 'Path to the publish directory')
    .addHelpText(
      'after',
      `Simulates Netlify's Edge routing logic to match specific requests.
This command is designed to mimic cURL's command line, so the flags are more familiar.`,
    )
    .addExamples([
      'netlify dev:trace http://localhost/routing-path',
      'netlify dev:trace -w dist-directory http://localhost/routing-path',
      'netlify dev:trace -X POST http://localhost/routing-path',
      'netlify dev:trace -H "Accept-Language es" http://localhost/routing-path',
      'netlify dev:trace --cookie nf_jwt=token http://localhost/routing-path',
    ])
    .action(devTrace)

module.exports = { createDevTraceCommand }
