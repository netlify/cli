import AsciiTable from 'ascii-table'
import { OptionValues } from 'commander'
import { methods } from 'netlify'

import { chalk, exit, logJson } from '../../utils/command-helpers.js'
import { NetlifyLog, intro, outro, spinner } from '../../utils/styles/index.js'
import BaseCommand from '../base-command.js'

export const apiCommand = async (apiMethod: string, options: OptionValues, command: BaseCommand) => {
  intro('api')
  const { api } = command.netlify

  if (options.list) {
    intro('api')
    const table = new AsciiTable(`Netlify API Methods`)
    table.setHeading('API Method', 'Docs Link')
    methods.forEach((method) => {
      const { operationId } = method
      table.addRow(operationId, `https://open-api.netlify.com/#operation/${operationId}`)
    })
    NetlifyLog.message(table.toString())

    outro(
      `Above is a list of available API methods. To run a method use "${chalk.cyanBright('netlify api methodName')}"`,
    )
    exit()
  }

  if (!apiMethod) {
    NetlifyLog.error(`You must provide an API method. Run "netlify api --list" to see available methods`, {
      exit: true,
    })
  }

  if (!api[apiMethod] || typeof api[apiMethod] !== 'function') {
    NetlifyLog.error(`"${apiMethod}"" is not a valid api method. Run "netlify api --list" to see available methods`)
  }

  let payload
  if (options.data) {
    payload = typeof options.data === 'string' ? JSON.parse(options.data) : options.data
  } else {
    payload = {}
  }

  const loading = spinner()
  try {
    loading.start('Fetching data from API')
    const apiResponse = await api[apiMethod](payload)
    loading.stop('Successfully fetched data from API')
    logJson(apiResponse)
  } catch (error) {
    loading.stop('Failed to fetch data from API', 1)
    if (error instanceof Error || typeof error === 'string') {
      NetlifyLog.error(error)
    } else {
      NetlifyLog.error('An unknown error occurred')
    }
  }
}
