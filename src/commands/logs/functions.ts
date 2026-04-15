import { OptionValues } from 'commander'

import { chalk, log, logAndThrowError, netlifyCommand } from '../../utils/command-helpers.js'
import { getWebSocket } from '../../utils/websockets/index.js'
import type BaseCommand from '../base-command.js'

import { buildFunctionLogsUrl, fetchHistoricalLogs, formatLogLine, parseTimeValue } from './log-api.js'
import { CLI_LOG_LEVEL_CHOICES_STRING, LOG_LEVELS_LIST } from './log-levels.js'

const DEPLOY_ID_RE = /^[a-f0-9]{24}$/
const MAX_CONCURRENT_FUNCTIONS = 10

interface NetlifyFunction {
  a: string
  oid: string
  n: string
  branch?: string | null
}

const functionPrefix = (functionName: string) => `[Function: ${functionName}]`

const hostnamesForSite = (siteInfo: {
  name?: string
  custom_domain?: string
  domain_aliases?: string[]
  url?: string
  ssl_url?: string
}): { canonicalHostnames: Set<string>; netlifyAppBaseHost: string | null } => {
  const canonical = new Set<string>()
  const addUrl = (value?: string) => {
    if (!value) return
    try {
      canonical.add(new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase())
    } catch {
      // ignore invalid entries
    }
  }

  addUrl(siteInfo.url)
  addUrl(siteInfo.ssl_url)
  if (siteInfo.custom_domain) {
    canonical.add(siteInfo.custom_domain.toLowerCase())
  }
  for (const alias of siteInfo.domain_aliases ?? []) {
    canonical.add(alias.toLowerCase())
  }

  const netlifyAppBaseHost = siteInfo.name ? `${siteInfo.name.toLowerCase()}.netlify.app` : null
  if (netlifyAppBaseHost) {
    canonical.add(netlifyAppBaseHost)
  }

  return { canonicalHostnames: canonical, netlifyAppBaseHost }
}

async function resolveDeployIdFromUrl(
  urlInput: string,
  client: any,
  siteId: string,
  siteInfo: {
    name?: string
    custom_domain?: string
    domain_aliases?: string[]
    url?: string
    ssl_url?: string
  },
): Promise<string | undefined> {
  let parsed: URL
  try {
    parsed = new URL(urlInput.includes('://') ? urlInput : `https://${urlInput}`)
  } catch {
    throw new Error(`Invalid --url value: ${urlInput}`)
  }

  const hostname = parsed.hostname.toLowerCase()
  const { canonicalHostnames, netlifyAppBaseHost } = hostnamesForSite(siteInfo)

  if (canonicalHostnames.has(hostname)) {
    return undefined
  }

  const mismatchError = new Error(
    `The URL ${urlInput} doesn't seem to match the linked project${siteInfo.name ? ` (${siteInfo.name})` : ''}.`,
  )

  if (!netlifyAppBaseHost || !hostname.endsWith(`.netlify.app`)) {
    throw mismatchError
  }

  const firstLabel = hostname.split('.')[0] ?? ''
  const separatorIndex = firstLabel.indexOf('--')
  if (separatorIndex === -1) {
    throw mismatchError
  }

  const prefix = firstLabel.slice(0, separatorIndex)
  const suffix = firstLabel.slice(separatorIndex + 2)
  if (suffix !== siteInfo.name?.toLowerCase()) {
    throw mismatchError
  }

  if (DEPLOY_ID_RE.test(prefix)) {
    return prefix
  }

  const deploys = (await client.listSiteDeploys({ siteId, branch: prefix, per_page: 20 })) as any[]
  const ready = deploys.find((deploy) => deploy.state === 'ready')
  if (!ready) {
    throw new Error(`No ready deploys found for branch ${prefix}`)
  }
  return ready.id as string
}

function streamFunctionLogs(
  fn: NetlifyFunction,
  siteId: string,
  accessToken: string | null | undefined,
  levelsToPrint: string[],
  showName: boolean,
) {
  const ws = getWebSocket('wss://socketeer.services.netlify.com/function/logs')

  ws.on('open', () => {
    ws.send(
      JSON.stringify({
        function_id: fn.oid,
        site_id: siteId,
        access_token: accessToken,
        account_id: fn.a,
      }),
    )
  })

  ws.on('message', (data: string) => {
    const logData = JSON.parse(data) as { level: string; message: string; ts?: number }
    if (!levelsToPrint.includes(logData.level.toLowerCase())) {
      return
    }
    log(
      formatLogLine({
        level: logData.level,
        message: logData.message,
        prefix: showName ? functionPrefix(fn.n) : undefined,
        timestamp: typeof logData.ts === 'number' ? logData.ts : Date.now(),
      }),
    )
  })

  ws.on('close', () => {
    log(`Connection closed${showName ? ` (${fn.n})` : ''}`)
  })

  ws.on('error', (err: any) => {
    log(`Connection error${showName ? ` (${fn.n})` : ''}`)
    log(err)
  })
}

export const logsFunction = async (functionNames: string[], options: OptionValues, command: BaseCommand) => {
  const client = command.netlify.api
  const { site, siteInfo } = command.netlify
  const { id: siteId } = site

  if (options.level && !options.level.every((level: string) => LOG_LEVELS_LIST.includes(level))) {
    log(`Invalid log level. Choices are:${CLI_LOG_LEVEL_CHOICES_STRING}`)
  }

  const levelsToPrint = options.level || LOG_LEVELS_LIST

  if (options.until && !options.since) {
    log('--until requires --since to also be set.')
    return
  }
  let historicalRange: { from: number; to: number } | undefined
  if (options.since) {
    try {
      const now = Date.now()
      const from = parseTimeValue(options.since, now)
      const to = options.until ? parseTimeValue(options.until, now) : now
      if (from >= to) {
        log('--since must be earlier than --until.')
        return
      }
      historicalRange = { from, to }
    } catch (error) {
      log((error as Error).message)
      return
    }
  }

  let deployId: string | undefined
  if (options.url) {
    try {
      deployId = await resolveDeployIdFromUrl(options.url, client, siteId!, siteInfo)
    } catch (error) {
      const message = (error as Error).message
      const isMismatch = message.includes("doesn't seem to match")
      if (isMismatch && siteInfo.name) {
        const suggestionParts = [
          netlifyCommand(),
          'logs:function',
          ...functionNames,
          options.since ? `--since ${options.since}` : null,
          options.until ? `--until ${options.until}` : null,
          `--url https://${siteInfo.name}.netlify.app`,
        ].filter(Boolean) as string[]
        return logAndThrowError(`${message}\nTry running ${chalk.cyan(suggestionParts.join(' '))}`)
      }
      return logAndThrowError(message)
    }
  }

  let functions: NetlifyFunction[]
  if (deployId) {
    const deploy = (await client.getSiteDeploy({ siteId: siteId!, deployId })) as any
    functions = (deploy?.available_functions ?? []) as NetlifyFunction[]
  } else {
    // TODO: Update type once the open api spec is updated https://open-api.netlify.com/#tag/function/operation/searchSiteFunctions
    const searchResponse = (await client.searchSiteFunctions({ siteId: siteId! })) as any
    functions = (searchResponse.functions ?? []) as NetlifyFunction[]
  }

  if (functions.length === 0) {
    log(`No functions found for the ${deployId ? 'deploy' : 'project'}`)
    return
  }

  let selectedFunctions: NetlifyFunction[]
  if (functionNames.length > 0) {
    selectedFunctions = []
    for (const name of functionNames) {
      const match = functions.find((fn) => fn.n === name)
      if (!match) {
        log(`Could not find function ${name}`)
        return
      }
      selectedFunctions.push(match)
    }
  } else {
    if (functions.length > MAX_CONCURRENT_FUNCTIONS) {
      const exampleNames = functions.slice(0, 3).map((fn) => fn.n)
      const exampleCommand = `${netlifyCommand()} logs:function ${exampleNames.join(' ')} --since 1h`
      return logAndThrowError(
        `You can only stream logs for up to ${MAX_CONCURRENT_FUNCTIONS} functions at a time — this project has ${
          functions.length
        }.\nSpecify function names as arguments to choose which ones to view, for example:\n\n  ${chalk.cyan(
          exampleCommand,
        )}`,
      )
    }
    selectedFunctions = functions
  }

  const showName = selectedFunctions.length > 1

  if (historicalRange) {
    const results = await Promise.all(
      selectedFunctions.map(async (fn) => {
        const baseUrl = buildFunctionLogsUrl({ siteId: siteId!, branch: fn.branch, functionName: fn.n })
        const entries = await fetchHistoricalLogs({
          baseUrl,
          accessToken: client.accessToken,
          from: historicalRange.from,
          to: historicalRange.to,
          deployId,
        })
        return entries.map((entry) => ({ functionName: fn.n, entry }))
      }),
    )

    const merged = results.flat().sort((a, b) => a.entry.ts - b.entry.ts)

    if (merged.length === 0) {
      log('No logs found for the given time range.')
      return
    }

    for (const { functionName, entry } of merged) {
      const level = entry.level || 'INFO'
      if (!levelsToPrint.includes(level.toLowerCase())) {
        continue
      }
      log(
        formatLogLine({
          level,
          message: entry.message,
          prefix: showName ? functionPrefix(functionName) : undefined,
          timestamp: entry.ts,
        }),
      )
    }
    return
  }

  const baseCommand = netlifyCommand()
  if (selectedFunctions.length === 1) {
    log(
      `Tip: To view logs for the past hour, run ${chalk.cyan(
        `${baseCommand} logs:function ${selectedFunctions[0].n} --since 1h`,
      )}`,
    )
    log('')
    log(`Polling for logs from function ${selectedFunctions[0].n}...`)
    log('')
  } else {
    log(`Tip: To view logs for the past hour, run ${chalk.cyan(`${baseCommand} logs:function --since 1h`)}`)
    log('')
    log(`Polling for logs from ${selectedFunctions.length} functions...`)
    log('')
  }

  for (const fn of selectedFunctions) {
    streamFunctionLogs(fn, siteId!, client.accessToken, levelsToPrint, showName)
  }
}
