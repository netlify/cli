import { methods, type NetlifyAPI } from '@netlify/api'
import AsciiTable from 'ascii-table'
import type { OptionValues } from 'commander'

import { chalk, logAndThrowError, exit, log, logJson } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'

type ApiMethodName = keyof NetlifyAPI
type ApiMethod = (payload: unknown) => Promise<unknown>

const isValidApiMethod = (api: NetlifyAPI, apiMethod: string): apiMethod is ApiMethodName =>
  Object.hasOwn(api, apiMethod)

// The method name comes from CLI args, so the value is read dynamically (as `unknown`); this guard
// confirms it's callable and gives it a single, honest call signature.
const isCallable = (value: unknown): value is ApiMethod => typeof value === 'function'

export const apiCommand = async (apiMethodName: string, options: OptionValues, command: BaseCommand) => {
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

  if (!apiMethodName) {
    return logAndThrowError(`You must provide an API method. Run "netlify api --list" to see available methods`)
  }

  const apiMethod: unknown = isValidApiMethod(api, apiMethodName) ? Reflect.get(api, apiMethodName) : undefined
  if (!isCallable(apiMethod)) {
    return logAndThrowError(
      `"${apiMethodName}"" is not a valid api method. Run "netlify api --list" to see available methods`,
    )
  }

  let payload
  if (options.data) {
    payload = typeof options.data === 'string' ? JSON.parse(options.data) : options.data
  } else {
    payload = {}
  }
  try {
    const apiResponse = await apiMethod.call(api, payload)
    logJson(apiResponse)
  } catch (error_) {
    return logAndThrowError(error_)
  }
}
