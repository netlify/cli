const Command = require('../utils/command')
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

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'api',
      },
    })

    if (isEmptyCommand(flags, args) || flags.list) {
      const table = new AsciiTable(`Netlify API Methods`)
      table.setHeading('API Method', 'Docs Link')
      methods.forEach(method => {
        const { operationId } = method
        table.addRow(operationId, `https://open-api.netlify.com/#/operation/${operationId}`)
      })
      this.log(table.toString())
      this.log()
      this.log('Above is a list of available API methods')
      this.log(`To run a method use "${chalk.cyanBright('netlify api methodName')}"`)
      this.exit()
    }

    if (!apiMethod) {
      this.error(`You must provide an API method. Run "netlify api --list" to see available methods`)
    }

    if (!api[apiMethod] || typeof api[apiMethod] !== 'function') {
      this.error(`"${apiMethod}"" is not a valid api method. Run "netlify api --list" to see available methods`)
    }

    let payload
    if (flags.data) {
      payload = typeof flags.data === 'string' ? JSON.parse(flags.data) : flags.data
    } else {
      payload = {}
    }
    try {
      const apiResponse = await api[apiMethod](payload)
      this.log(JSON.stringify(apiResponse, null, 2))
    } catch (e) {
      this.error(e)
    }
  }
}

APICommand.description = `Run any Netlify API method

For more information on available methods checkout https://open-api.netlify.com/ or run "netlify api --list"
`

APICommand.args = [
  {
    name: 'apiMethod',
    description: 'Open API method to run',
  },
]

APICommand.examples = ['netlify api --list', 'netlify api getSite --data \'{ "site_id": "123456"}\'']

APICommand.flags = {
  data: oclif.flags.string({
    char: 'd',
    description: 'Data to use',
  }),
  list: oclif.flags.boolean({
    description: 'List out available API methods',
  }),
  ...APICommand.flags,
}

APICommand.strict = false

module.exports = APICommand
