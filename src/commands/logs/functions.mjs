import inquirer from 'inquirer'

import { chalk, log } from '../../utils/command-helpers.mjs'
import { getWebSocket } from '../../utils/websockets/index.mjs'

function getLog(logData) {
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

/**
 * The stream build logs command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const logsFunction = async (functionName, options, command) => {
  const client = command.netlify.api
  const { site } = command.netlify
  const { id: siteId } = site

  const { functions } = await client.searchSiteFunctions({ siteId })

  let selectedFunction
  if (functionName) {
    selectedFunction = functions.find((fn) => fn.n === functionName)
  } else {
    const { result } = await inquirer.prompt({
      name: 'result',
      type: 'list',
      message: 'Select a function',
      choices: functions.map((fn) => fn.n),
    })

    selectedFunction = functions.find((fn) => fn.n === result)
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

  ws.on('message', (data) => {
    const logData = JSON.parse(data)
    log(getLog(logData))
  })

  ws.on('close', () => {
    log('Connection closed')
  })

  ws.on('error', (err) => {
    log('Connection error')
    log(err)
  })
}

/**
 * Creates the `netlify watch` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createLogsFunctionCommand = (program) =>
  program
    .command('logs:function')
    .addArgument('<functionName>', 'The name of the function to stream logs for')
    .addExamples(['netlify logs:function my-function', 'netlify logs:function'])
    .description('(Beta) Stream serverless function logs to the console')
    .action(logsFunction)
