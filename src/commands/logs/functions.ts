import { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, log } from '../../utils/command-helpers.js'
import { getWebSocket } from '../../utils/websockets/index.js'
import type BaseCommand from '../base-command.js'

import { parseDateToMs, fetchHistoricalLogs, printHistoricalLogs } from './log-api.js'
import { CLI_LOG_LEVEL_CHOICES_STRING, LOG_LEVELS, LOG_LEVELS_LIST } from './log-levels.js'

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
  await command.authenticate()

  const client = command.netlify.api
  const { site, siteInfo } = command.netlify
  const { id: siteId } = site

  if (options.level && !options.level.every((level: string) => LOG_LEVELS_LIST.includes(level))) {
    log(`Invalid log level. Choices are:${CLI_LOG_LEVEL_CHOICES_STRING}`)
  }

  const levelsToPrint = options.level || LOG_LEVELS_LIST

  let functions: any[]
  if (options.deployId) {
    const deploy = (await client.getSiteDeploy({ siteId: siteId!, deployId: options.deployId })) as any
    functions = deploy.available_functions ?? []
  } else {
    // TODO: Update type once the open api spec is updated https://open-api.netlify.com/#tag/function/operation/searchSiteFunctions
    const result = (await client.searchSiteFunctions({ siteId: siteId! })) as any
    functions = result.functions ?? []
  }

  if (functions.length === 0) {
    log(`No functions found for the ${options.deployId ? 'deploy' : 'project'}`)
    return
  }

  let selectedFunction
  if (functionName) {
    selectedFunction = functions.find((fn: any) => fn.n === functionName || fn.oid === functionName)
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

  const { a: accountId, n: resolvedFunctionName, oid: functionId } = selectedFunction

  if (options.from) {
    const fromMs = parseDateToMs(options.from)
    const toMs = options.to ? parseDateToMs(options.to) : Date.now()
    const branch = siteInfo.build_settings?.repo_branch ?? 'main'

    const url = `https://analytics.services.netlify.com/v2/sites/${siteId}/branch/${branch}/function_logs/${resolvedFunctionName}?from=${fromMs.toString()}&to=${toMs.toString()}`
    const data = await fetchHistoricalLogs({ url, accessToken: client.accessToken ?? '' })
    printHistoricalLogs(data, levelsToPrint)
    return
  }

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
