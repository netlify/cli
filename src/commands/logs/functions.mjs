import inquirer from 'inquirer'
import WebSocket from 'ws'

import { chalk, error, log } from '../../utils/command-helpers.mjs'

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
const logsFunction = async (options, command) => {
  await command.authenticate()
  const client = command.netlify.api
  const { site } = command.netlify
  const { id: siteId } = site

  const token = client.accessToken

  const functionsRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/functions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const [functionName] = command.args

  const { functions } = await functionsRes.json()

  let selectedFunction
  if (functionName) {
    selectedFunction = functions.find((f) => f.n === functionName)
  } else {
    const { result } = await inquirer.prompt({
      name: 'result',
      type: 'list',
      message: 'Select a function',
      choices: functions.map((f) => f.n),
    })

    selectedFunction = functions.find((f) => f.n === result)
  }

  if (!selectedFunction) {
    log(`Could not find function ${functionName}`)
    return
  }

  const { a: accountId, oid: functionId } = selectedFunction

  const ws = new WebSocket(`wss://socketeer.services.netlify.com/function/logs`)

  ws.on('open', function open() {
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
export const createLogsFunctionCommand = (program) => program.command('logs:function').action(logsFunction)
