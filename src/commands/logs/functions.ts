import { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, log } from '../../utils/command-helpers.js'
import { getWebSocket } from '../../utils/websockets/index.js'
import type BaseCommand from '../base-command.js'

import { CLI_LOG_LEVEL_CHOICES_STRING, LOG_LEVELS, LOG_LEVELS_LIST } from './log-levels.js'
import { NetlifyLog, intro, outro, select } from '../../utils/styles/index.js'
function getLog(logData: { level: string; message: string }) {
  let logString = ''
  switch (logData.level) {
    case LOG_LEVELS.INFO:
      logString += chalk.blueBright(logData.level)
      break
    case LOG_LEVELS.WARN:
      logString += chalk.yellowBright(logData.level)
      break
    case LOG_LEVELS.ERROR:
      logString += chalk.redBright(logData.level)
      break
    default:
      logString += logData.level
      break
  }
  return `${logString} ${logData.message}`
}

export const logsFunction = async (functionName: string | undefined, options: OptionValues, command: BaseCommand) => {
  intro('logs:function')
  const client = command.netlify.api
  const { site } = command.netlify
  const { id: siteId } = site

  if (options.level && !options.level.every((level: string) => LOG_LEVELS_LIST.includes(level))) {
    NetlifyLog.warn(`Invalid log level. Choices are:${CLI_LOG_LEVEL_CHOICES_STRING}`)
  }

  const levelsToPrint = options.level || LOG_LEVELS_LIST

  const { functions = [] } = await client.searchSiteFunctions({ siteId })

  if (functions.length === 0) {
    NetlifyLog.error(`No functions found for the site`, { exit: true })
  }

  let selectedFunction
  if (functionName) {
    selectedFunction = functions.find((fn: any) => fn.n === functionName)
  } else {
    const result = await select({
      message: 'Select a function',
      maxItems: 7,
      options: functions.map((fn: { n: string }) => ({
        value: fn.n,
      })),
    })

    selectedFunction = functions.find((fn: { n: string }) => fn.n === result)
  }

  if (!selectedFunction) {
    NetlifyLog.error(`Could not find function ${functionName}`)
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
    NetlifyLog.message(getLog(logData))
  })

  ws.on('close', () => {
    NetlifyLog.info('Connection closed')
  })

  ws.on('error', (err: unknown) => {
    NetlifyLog.error('Connection error', { exit: false })
    NetlifyLog.error(err)
  })

  process.on('SIGINT', () => {
    outro({ message: 'Closing connection', exit: true })
  })
}
