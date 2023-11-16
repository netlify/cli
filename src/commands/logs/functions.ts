import { Argument, OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, log } from '../../utils/command-helpers.js'
import { getWebSocket } from '../../utils/websockets/index.js'
import type BaseCommand from '../base-command.js'

function getLog(logData: { level: string; message: string }) {
  let logString = ''
  switch (logData.level) {
    case 'INFO':
      logString += chalk.blueBright(logData.level)
      break
    case 'WARN':
      logString += chalk.yellowBright(logData.level)
      break
    case 'ERROR':
      logString += chalk.redBright(logData.level)
      break
    default:
      logString += logData.level
      break
  }

  return `${logString} ${logData.message}`
}

const logsFunction = async (functionName: string | undefined, options: OptionValues, command: BaseCommand) => {
  const client = command.netlify.api
  const { site } = command.netlify
  const { id: siteId } = site

  const { functions } = await client.searchSiteFunctions({ siteId })

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

export const createLogsFunctionCommand = (program: BaseCommand) =>
  program
    .command('logs:function')
    .alias('logs:functions')
    .addArgument(new Argument('[functionName]', 'Name of the function to stream logs for'))
    .addExamples(['netlify logs:function my-function', 'netlify logs:function'])
    .description('(Beta) Stream netlify function logs to the console')
    .action(logsFunction)
