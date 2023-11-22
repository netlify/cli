import AsciiTable from 'ascii-table'
import { OptionValues } from 'commander'
import { methods } from 'netlify'

import { chalk, error, exit, log, logJson } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'

export const apiCommand = async (apiMethod: string, options: OptionValues, command: BaseCommand) => {
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
