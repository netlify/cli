import AsciiTable from 'ascii-table'
import { methods } from 'netlify'

import { chalk, error, exit, log, logJson } from '../../utils/command-helpers.mjs'

/**
 * The api command
 * @param {string} apiMethod
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'apiMethod' implicitly has an 'any' type... Remove this comment to see the full error message
const apiCommand = async (apiMethod, options, command) => {
  const { api } = command.netlify

  if (options.list) {
    const table = new AsciiTable(`Netlify API Methods`)
    table.setHeading('API Method', 'Docs Link')
    methods.forEach((method) => {
      const { operationId } = method
      table.addRow(operationId, `https://open-api.netlify.com/#operation/${operationId}`)
    })
    log(table.toString())
    log()
    log('Above is a list of available API methods')
    log(`To run a method use "${chalk.cyanBright('netlify api methodName')}"`)
    exit()
  }

  if (!apiMethod) {
    error(`You must provide an API method. Run "netlify api --list" to see available methods`)
  }

  if (!api[apiMethod] || typeof api[apiMethod] !== 'function') {
    error(`"${apiMethod}"" is not a valid api method. Run "netlify api --list" to see available methods`)
  }

  let payload
  if (options.data) {
    payload = typeof options.data === 'string' ? JSON.parse(options.data) : options.data
  } else {
    payload = {}
  }
  try {
    const apiResponse = await api[apiMethod](payload)
    logJson(apiResponse)
  } catch (error_) {
    // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
    error(error_)
  }
}

/**
 * Creates the `netlify api` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
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
    .action(apiCommand)
