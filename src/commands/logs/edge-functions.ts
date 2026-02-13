import { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, log } from '../../utils/command-helpers.js'
import { getWebSocket } from '../../utils/websockets/index.js'
import type BaseCommand from '../base-command.js'

import { parseDateToMs, fetchHistoricalLogs, printHistoricalLogs, formatLogEntry } from './log-api.js'
import { CLI_LOG_LEVEL_CHOICES_STRING, LOG_LEVELS_LIST } from './log-levels.js'
import { getName } from './build.js'

export const logsEdgeFunction = async (options: OptionValues, command: BaseCommand) => {
  let deployId = options.deployId as string | undefined
  await command.authenticate()

  const client = command.netlify.api
  const { site } = command.netlify
  const { id: siteId } = site

  if (!siteId) {
    log('You must link a project before attempting to view edge function logs')
    return
  }

  const levels = options.level as string[] | undefined
  if (levels && !levels.every((level) => LOG_LEVELS_LIST.includes(level))) {
    log(`Invalid log level. Choices are:${CLI_LOG_LEVEL_CHOICES_STRING.toString()}`)
  }

  const levelsToPrint: string[] = levels || LOG_LEVELS_LIST

  if (options.from) {
    const fromMs = parseDateToMs(options.from as string)
    const toMs = options.to ? parseDateToMs(options.to as string) : Date.now()

    const url = `https://analytics.services.netlify.com/v2/sites/${siteId}/edge_function_logs?from=${fromMs.toString()}&to=${toMs.toString()}`
    const data = await fetchHistoricalLogs({ url, accessToken: client.accessToken ?? '' })
    printHistoricalLogs(data, levelsToPrint)
    return
  }

  const userId = command.netlify.globalConfig.get('userId') as string

  if (!deployId) {
    const deploys = await client.listSiteDeploys({ siteId })

    if (deploys.length === 0) {
      log('No deploys found for the project')
      return
    }

    if (deploys.length === 1) {
      deployId = deploys[0].id
    } else {
      const { result } = (await inquirer.prompt({
        name: 'result',
        type: 'list',
        message: `Select a deploy\n\n${chalk.yellow('*')} indicates a deploy created by you`,
        choices: deploys.map((deploy) => ({
          name: getName({ deploy, userId }),
          value: deploy.id,
        })),
      })) as { result: string }

      deployId = result
    }
  }

  const ws = getWebSocket('wss://socketeer.services.netlify.com/edge-function/logs')

  ws.on('open', () => {
    ws.send(
      JSON.stringify({
        deploy_id: deployId,
        site_id: siteId,
        access_token: client.accessToken,
        since: new Date().toISOString(),
      }),
    )
  })

  ws.on('message', (data: string) => {
    const logData = JSON.parse(data) as { level: string; message: string; timestamp?: string }
    if (!levelsToPrint.includes(logData.level.toLowerCase())) {
      return
    }
    log(formatLogEntry(logData))
  })

  ws.on('close', () => {
    log('Connection closed')
  })

  ws.on('error', (err: Error) => {
    log('Connection error')
    log(err.message)
  })
}
