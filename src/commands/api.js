const Command = require('@netlify/cli-utils')
const AsciiTable = require('ascii-table')
const chalk = require('chalk')
const oclif = require('@oclif/command')
const { methods } = require('netlify')
const { parseRawFlags } = require('../utils/parse-raw-flags')
const { isEmptyCommand } = require('../utils/check-command-inputs')

class APICommand extends Command {
  async run() {
    const { api, site } = this.netlify
    const { args, flags, raw } = this.parse(APICommand)
    const [ accessToken, location ] = this.getConfigToken()

    const rawArgs = process.argv.slice(2)
    const apiCommand = rawArgs.filter((arg) => arg !== 'api').find((arg) => !arg.match(/^-/))
    const rawFlags = parseRawFlags(raw)

    if (isEmptyCommand(flags, args) || rawFlags.list) {
      const table = new AsciiTable(`Netlify API Methods`)
      table.setHeading('API Method', 'Docs Link')
      methods.forEach((method) => {
        const { operationId } = method
        table.addRow(operationId, `https://open-api.netlify.com/#/default/${operationId}`)
      })
      this.log(table.toString())
      this.log()
      this.log('Above is a list of available API methods')
      this.log(`To run a method use "${chalk.cyanBright('netlify api methodName')}"`)
      this.exit()
    }

    if (!api[apiCommand] || typeof api[apiCommand] !== 'function') {
      this.error(`${apiCommand} is not a valid api method. Run "netlify api --list" to see available methods`)
    }

    if (flags.data) {
      const payload = (typeof flags.data === 'string') ? JSON.parse(flags.data) : flags.data
      let apiResponse
      try {
        apiResponse = await api[apiCommand](payload)
      } catch (e) {
        this.error(e)
      }
      if (apiResponse) {
        this.log(apiResponse)
      }
    }
  }
}

APICommand.description = `Run Netlify API Methods

For more information on available methods checkout https://open-api.netlify.com/#/default or run "netlify api --list"
`

APICommand.args = [
  {
    name: 'apiMethod',
    required: true,
    description: 'Open API method to run'
  }
]

APICommand.flags = {
  data: oclif.flags.string({
    char: 'd',
    description: 'Data to use'
  }),
  list: oclif.flags.boolean({
    description: 'List out available API methods'
  }),
}

APICommand.strict = false

module.exports = APICommand
