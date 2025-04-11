import { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { ansis, log } from '../../utils/command-helpers.js'
import { getWebSocket } from '../../utils/websockets/index.js'
import type BaseCommand from '../base-command.js'

import { CLI_LOG_LEVEL_CHOICES_STRING, LOG_LEVELS, LOG_LEVELS_LIST } from './log-levels.js'

function getLog(logData: { level: string; message: string }) {
  let logString = ''
  switch (logData.level) {
    case LOG_LEVELS.INFO:
      logString += ansis.blueBright(logData.level)
      break
    case LOG_LEVELS.WARN:
      logString += ansis.yellowBright(logData.level)
      break
    case LOG_LEVELS.ERROR:
      logString += ansis.redBright(logData.level)
      break
    default:
      logString += logData.level
      break
  }

  return `${logString} ${logData.message}`
}

export const logsFunction = async (functionName: string | undefined, options: OptionValues, command: BaseCommand) => {
  const client = command.netlify.api
  const { site } = command.netlify
  const { id: siteId } = site

  if (options.level && !options.level.every((level: string) => LOG_LEVELS_LIST.includes(level))) {
    log(`Invalid log level. Choices are:${CLI_LOG_LEVEL_CHOICES_STRING}`)
  }

  const levelsToPrint = options.level || LOG_LEVELS_LIST

  // TODO: Update type once the open api spec is updated https://open-api.netlify.com/#tag/function/operation/searchSiteFunctions
  const { functions = [] } = (await client.searchSiteFunctions({ siteId: siteId! })) as any

  if (functions.length === 0) {
    log(`No functions found for the site`)
    return
  }

  let selectedFunction
  if (functionName) {
    selectedFunction = functions.find((fn: any) => fn.n === functionName)
  } else {
    const { result } = await inquirer.prompt({
      name: 'result',
      type: 'list',
      message: 'Select a function',
      choices: functions.map((fn: any) => fn.n),
    })

    selectedFunction = functions.find((fn: any) => fn.n === result)
  }

  if (!selectedFunction) {
    log(`Could not find function ${functionName}`)
    return
  }

  const { a: accountId, oid: functionId } = selectedFunction

  const ws = getWebSocket('wss://socketeer.services.netlify.com/function/logs')

  ws.on('open', () => {
    ws.send(
      JSON.stringify({
        function_id: functionId,
        site_id: siteId,
        access_token: client.accessToken,
        account_id: accountId,
      }),
    )
  })

  ws.on('message', (data: string) => {
    const logData = JSON.parse(data)
    if (!levelsToPrint.includes(logData.level.toLowerCase())) {
      return
    }
    log(getLog(logData))
  })

  ws.on('close', () => {
    log('Connection closed')
  })

  ws.on('error', (err: any) => {
    log('Connection error')
    log(err)
  })
}
