import { OptionValues } from 'commander'

import { chalk, log } from '../../utils/command-helpers.js'
import { getWebSocket } from '../../utils/websockets/index.js'
import type BaseCommand from '../base-command.js'

import { parseDuration } from './duration.js'
import { CLI_LOG_LEVEL_CHOICES_STRING, LOG_LEVELS, LOG_LEVELS_LIST } from './log-levels.js'

const ANALYTICS_API_BASE = 'https://analytics.services.netlify.com'
const DEPLOY_ID_RE = /^[a-f0-9]{24}$/

interface NetlifyFunction {
  a: string
  oid: string
  n: string
  branch?: string | null
}

interface HistoricalLogEntry {
  ts: number
  type: string
  message: string
  request_id?: string
  netlify_request_id?: string
  level: string
}

function getLog(logData: { level: string; message: string }, functionName?: string) {
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

  const prefix = functionName ? `${chalk.cyan(`[${functionName}]`)} ` : ''
  return `${prefix}${logString} ${logData.message}`
}

async function resolveDeployFromUrl(
  urlInput: string,
  client: any,
  siteId: string,
): Promise<{ deployId?: string }> {
  let parsed: URL
  try {
    parsed = new URL(urlInput.includes('://') ? urlInput : `https://${urlInput}`)
  } catch {
    throw new Error(`Invalid --url value: ${urlInput}`)
  }

  const firstLabel = parsed.hostname.split('.')[0] ?? ''
  const separatorIndex = firstLabel.indexOf('--')
  if (separatorIndex === -1) {
    return {}
  }

  const prefix = firstLabel.slice(0, separatorIndex)
  if (DEPLOY_ID_RE.test(prefix)) {
    return { deployId: prefix }
  }

  const deploys = (await client.listSiteDeploys({ siteId, branch: prefix, per_page: 20 })) as any[]
  const ready = deploys.find((deploy) => deploy.state === 'ready')
  if (!ready) {
    throw new Error(`No ready deploys found for branch ${prefix}`)
  }
  return { deployId: ready.id as string }
}

const debugLog = (message: string) => {
  if (process.env.DEBUG) {
    log(chalk.dim(`[debug] ${message}`))
  }
}

async function fetchHistoricalLogs({
  siteId,
  functionName,
  branch,
  accessToken,
  from,
  to,
  deployId,
}: {
  siteId: string
  functionName: string
  branch?: string | null
  accessToken: string | null | undefined
  from: number
  to: number
  deployId?: string
}): Promise<HistoricalLogEntry[]> {
  const entries: HistoricalLogEntry[] = []
  let cursor: string | undefined
  let page = 0

  do {
    const params = new URLSearchParams()
    params.set('from', String(from))
    params.set('to', String(to))
    if (deployId) {
      params.set('deploy_id', deployId)
    }
    if (cursor) {
      params.set('cursor', cursor)
    }

    const branchPath = branch ? `branch/${encodeURIComponent(branch)}/` : ''
    const url = `${ANALYTICS_API_BASE}/v2/sites/${siteId}/${branchPath}function_logs/${encodeURIComponent(functionName)}?${params.toString()}`
    page += 1
    debugLog(`GET ${url} (function=${functionName}, page=${page})`)

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken ?? ''}`,
        'Content-Type': 'application/json',
      },
    })

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    debugLog(
      `← ${response.status} ${response.statusText} (function=${functionName}, page=${page}) headers=${JSON.stringify(responseHeaders)}`,
    )

    const rawBody = await response.text()
    debugLog(`response body (${rawBody.length} bytes): ${rawBody.slice(0, 2000)}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch logs for ${functionName}: ${response.status} ${response.statusText}`)
    }

    let body: { logs?: HistoricalLogEntry[]; pagination?: { next?: string } }
    try {
      body = JSON.parse(rawBody)
    } catch (error) {
      debugLog(`failed to parse response as JSON`)
      throw error
    }

    const pageLogs = body.logs ?? []
    debugLog(
      `function=${functionName} page=${page} received ${pageLogs.length} entries, next cursor=${body.pagination?.next ?? '(none)'}`,
    )
    entries.push(...pageLogs)
    cursor = body.pagination?.next
  } while (cursor)

  return entries
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
    const logData = JSON.parse(data)
    if (!levelsToPrint.includes(logData.level.toLowerCase())) {
      return
    }
    log(getLog(logData, showName ? fn.n : undefined))
  })

  ws.on('close', () => {
    log(`Connection closed${showName ? ` (${fn.n})` : ''}`)
  })

  ws.on('error', (err: any) => {
    log(`Connection error${showName ? ` (${fn.n})` : ''}`)
    log(err)
  })
}

const MAX_CONCURRENT_FUNCTIONS = 10

export const logsFunction = async (functionNames: string[], options: OptionValues, command: BaseCommand) => {
  const client = command.netlify.api
  const { site } = command.netlify
  const { id: siteId } = site

  if (options.level && !options.level.every((level: string) => LOG_LEVELS_LIST.includes(level))) {
    log(`Invalid log level. Choices are:${CLI_LOG_LEVEL_CHOICES_STRING}`)
  }

  const levelsToPrint = options.level || LOG_LEVELS_LIST

  let durationMs: number | null = null
  if (options.timeline) {
    durationMs = parseDuration(options.timeline)
    if (!durationMs) {
      log(`Invalid --timeline value "${options.timeline}". Use a duration like 30m, 1h, 2h, 1d, or 1h30m.`)
      return
    }
  }

  let deployId: string | undefined
  if (options.url) {
    try {
      debugLog(`resolving --url ${options.url}`)
      const resolved = await resolveDeployFromUrl(options.url, client, siteId!)
      deployId = resolved.deployId
      debugLog(`resolved deploy_id=${deployId ?? '(production, no filter)'}`)
    } catch (error) {
      log((error as Error).message)
      return
    }
  }

  if (deployId && !options.timeline) {
    log('Real-time logs cannot be scoped to a specific deploy. Use --timeline to fetch historical logs.')
    return
  }

  // TODO: Update type once the open api spec is updated https://open-api.netlify.com/#tag/function/operation/searchSiteFunctions
  const searchResponse = (await client.searchSiteFunctions({ siteId: siteId! })) as any
  debugLog(`searchSiteFunctions raw response: ${JSON.stringify(searchResponse).slice(0, 1500)}`)
  const { functions = [] } = searchResponse

  if (functions.length === 0) {
    log(`No functions found for the project`)
    return
  }

  let selectedFunctions: NetlifyFunction[]
  if (functionNames.length > 0) {
    selectedFunctions = []
    for (const name of functionNames) {
      const match = functions.find((fn: any) => fn.n === name)
      if (!match) {
        log(`Could not find function ${name}`)
        return
      }
      selectedFunctions.push(match)
    }
  } else {
    if (functions.length > MAX_CONCURRENT_FUNCTIONS) {
      log(
        `This project has ${functions.length} functions, but logs can only be streamed for up to ${MAX_CONCURRENT_FUNCTIONS} at a time. Specify function names as arguments to choose which ones to view.`,
      )
      return
    }
    selectedFunctions = functions
  }

  const showName = selectedFunctions.length > 1

  if (options.timeline) {
    const to = Date.now()
    const from = to - (durationMs ?? 0)
    debugLog(
      `historical window: from=${from} (${new Date(from).toISOString()}) to=${to} (${new Date(to).toISOString()}), durationMs=${durationMs}`,
    )
    debugLog(`selected functions: ${selectedFunctions.map((fn) => fn.n).join(', ')}`)

    const results = await Promise.all(
      selectedFunctions.map(async (fn) => {
        const entries = await fetchHistoricalLogs({
          siteId: siteId!,
          functionName: fn.n,
          branch: fn.branch,
          accessToken: client.accessToken,
          from,
          to,
          deployId,
        })
        debugLog(`function=${fn.n} branch=${fn.branch ?? '(none)'} total entries=${entries.length}`)
        return entries.map((entry) => ({ functionName: fn.n, entry }))
      }),
    )

    const merged = results.flat().sort((a, b) => a.entry.ts - b.entry.ts)
    debugLog(`total merged entries across all functions: ${merged.length}`)

    if (merged.length === 0) {
      log('No logs found for the given time range.')
      return
    }

    for (const { functionName, entry } of merged) {
      const level = entry.level || LOG_LEVELS.INFO
      if (!levelsToPrint.includes(level.toLowerCase())) {
        continue
      }
      log(getLog({ level, message: entry.message }, showName ? functionName : undefined))
    }
    return
  }

  if (showName) {
    log(`Streaming logs for ${selectedFunctions.length} functions`)
  }
  for (const fn of selectedFunctions) {
    streamFunctionLogs(fn, siteId!, client.accessToken, levelsToPrint, showName)
  }
}
