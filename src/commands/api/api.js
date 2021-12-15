// @ts-check
const AsciiTable = require('ascii-table')

// TODO: use static `import` after migrating this repository to pure ES modules
const jsClient = import('netlify')

const { chalk, error, exit, log, logJson } = require('../../utils')

/**
 * The api command
 * @param {string} apiMethod
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const apiCommand = async (apiMethod, options, command) => {
  const { api } = command.netlify

  if (options.list) {
    const table = new AsciiTable(`Netlify API Methods`)
    table.setHeading('API Method', 'Docs Link')
    const { methods } = await jsClient
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
    error(error_)
  }
}

/**
 * Creates the `netlify api` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createApiCommand = (program) =>
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

module.exports = { createApiCommand }
