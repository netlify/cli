const Command = require('@netlify/cli-utils')
const AsciiTable = require('ascii-table')
const chalk = require('chalk')
const oclif = require('@oclif/command')
const { methods } = require('netlify')
const { isEmptyCommand } = require('../utils/check-command-inputs')

class APICommand extends Command {
  async run() {
    const { api } = this.netlify
    const { args, flags } = this.parse(APICommand)

    const { apiMethod } = args

    if (isEmptyCommand(flags, args) || flags.list) {
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

    if (!apiMethod) {
      this.error(`You must provider an API method. Run "netlify api --list" to see available methods`)
    }

    if (!api[apiMethod] || typeof api[apiMethod] !== 'function') {
      this.error(`"${apiMethod}"" is not a valid api method. Run "netlify api --list" to see available methods`)
    }

    if (flags.data) {
      const payload = (typeof flags.data === 'string') ? JSON.parse(flags.data) : flags.data
      let apiResponse
      try {
        apiResponse = await api[apiMethod](payload)
      } catch (e) {
        this.error(e)
      }
      if (apiResponse) {
        this.log(JSON.stringify(apiResponse, null, 2))
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
