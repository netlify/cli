import { methods, type NetlifyAPI } from '@netlify/api'
import AsciiTable from 'ascii-table'

import { chalk, logAndThrowError, exit, log, logJson } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'
import type { ApiOptionValues } from './option_values.js'

type ApiMethodName = keyof NetlifyAPI
type ApiMethod = (payload: unknown) => Promise<unknown>

const isValidApiMethod = (api: NetlifyAPI, apiMethod: string): apiMethod is ApiMethodName =>
  Object.hasOwn(api, apiMethod)

const isCallable = (value: unknown): value is ApiMethod => typeof value === 'function'

// FIXME(@netlify/api): `methods` is typed as `any[]`
const apiMethodSpecs = methods as { operationId: string; parameters: { path?: Record<string, unknown> } }[]

export const apiCommand = async (apiMethodName: string | undefined, options: ApiOptionValues, command: BaseCommand) => {
  const { api } = command.netlify

  if (options.list) {
    const table = new AsciiTable(`Netlify API Methods`)
    table.setHeading('API Method', 'Docs Link')
    apiMethodSpecs.forEach(({ operationId }) => {
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

  // Calling `api[apiMethodName]` unions every method signature, which TS can't represent (TS2590), so read
  // the method dynamically and narrow it to one signature.
  const apiMethod: unknown = isValidApiMethod(api, apiMethodName) ? Reflect.get(api, apiMethodName) : undefined
  if (!isCallable(apiMethod)) {
    return logAndThrowError(
      `"${apiMethodName}"" is not a valid api method. Run "netlify api --list" to see available methods`,
    )
  }

  let payload: unknown
  if (options.data) {
    if (typeof options.data === 'string') {
      try {
        payload = JSON.parse(options.data)
      } catch {
        const received = options.data.length > 80 ? `${options.data.slice(0, 80)}…` : options.data
        return logAndThrowError(
          `Invalid JSON provided to the ${chalk.cyanBright('--data')} flag.
Received: ${received}
The --data flag expects a JSON object of API parameters, e.g. --data '{"site_id":"123456"}'.
Note: key=value pairs are not accepted; use JSON syntax instead.`,
        )
      }
    } else {
      payload = options.data
    }
  } else {
    payload = {}
  }
  try {
    const apiResponse = await apiMethod.call(api, payload)
    logJson(apiResponse)
  } catch (error_) {
    if (error_ instanceof Error && error_.message.includes('Missing required path variable')) {
      const pathVariables = apiMethodSpecs.find((method) => method.operationId === apiMethodName)?.parameters.path ?? {}
      const requiredNames = Object.keys(pathVariables).join(', ')
      return logAndThrowError(
        `${error_.message}
The ${chalk.cyanBright('--data')} flag must include the path variable(s) required by ${apiMethodName}${
          requiredNames ? `: ${requiredNames}` : ''
        }, e.g. --data '{"site_id":"123456"}'`,
      )
    }
    return logAndThrowError(error_)
  }
}
