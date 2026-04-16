import type { NetlifyAPI } from '@netlify/api'
import { OptionValues } from 'commander'

import { chalk, log, logAndThrowError, netlifyCommand } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'

import {
  colorForLabel,
  formatJsonLine,
  formatLogLine,
  parseTimeValue,
  resolveDeployIdFromUrl,
  SOURCE_INDICATORS,
  SOURCE_LABELS,
} from './log-api.js'
import type { LogEntry } from './log-api.js'
import { LOG_LEVELS_LIST, CLI_LOG_LEVEL_CHOICES_STRING } from './log-levels.js'
import {
  fetchDeployHistoricalLogs,
  findCurrentBuildingDeploy,
  findLatestReadyDeploy,
  streamDeploy,
} from './sources/deploy.js'
import { fetchEdgeFunctionHistoricalLogs, streamEdgeFunctions } from './sources/edge-functions.js'
import {
  fetchFunctionHistoricalLogs,
  listFunctions,
  selectFunctions,
  streamFunctions,
  validateFunctionCount,
} from './sources/functions.js'

type Source = 'functions' | 'edge-functions' | 'deploy'
const VALID_SOURCES: Source[] = ['functions', 'edge-functions', 'deploy']
const DEFAULT_SINCE = '10m'

const parseSources = (rawSources: string[]): Source[] => {
  const sources: Source[] = []
  for (const s of rawSources) {
    if (!VALID_SOURCES.includes(s as Source)) {
      throw new Error(`Invalid --source value "${s}". Valid values are: ${VALID_SOURCES.join(', ')}`)
    }
    if (!sources.includes(s as Source)) {
      sources.push(s as Source)
    }
  }
  return sources
}

const SOURCE_TO_ENTRY_SOURCE: Record<Source, LogEntry['source']> = {
  functions: 'function',
  'edge-functions': 'edge-function',
  deploy: 'deploy',
}

const humanizeTimeRange = (sinceValue: string | undefined, untilValue: string | undefined): string => {
  if (!sinceValue && !untilValue) {
    return 'for the last 10 minutes'
  }
  if (sinceValue && !untilValue) {
    return `for the last ${sinceValue}`
  }
  if (sinceValue && untilValue) {
    return `from ${sinceValue} to ${untilValue}`
  }
  return ''
}

const printHeader = (sources: Source[], timeDescription: string, isFollow: boolean) => {
  const sourceNames = sources.map((s) => {
    switch (s) {
      case 'functions':
        return 'functions'
      case 'edge-functions':
        return 'edge functions'
      case 'deploy':
        return 'deploy'
    }
  })

  const sourceList =
    sourceNames.length <= 2
      ? sourceNames.join(' and ')
      : `${sourceNames.slice(0, -1).join(', ')}, and ${String(sourceNames.at(-1))}`

  if (isFollow) {
    log(`Streaming logs from ${sourceList}:`)
  } else {
    log(`Showing logs from ${sourceList} ${timeDescription}:`)
  }
  log('')

  // Emoji are typically 2 columns wide; 𝒇 (U+1D487) is 1 column.
  // Pad single-width indicators so labels align.
  const INDICATOR_PAD: Record<string, string> = {
    function: ' ',
  }

  const activeSources = sources.map((s) => SOURCE_TO_ENTRY_SOURCE[s])
  for (const source of activeSources) {
    const pad = INDICATOR_PAD[source] ?? ''
    log(`  ${SOURCE_INDICATORS[source]}${pad}  ${chalk.dim(SOURCE_LABELS[source])}`)
  }
  log('')
}

const printEntry = (
  entry: LogEntry,
  levelsToPrint: string[],
  json: boolean,
  colorFn?: (text: string) => string,
): void => {
  const level = entry.level || 'INFO'
  if (!levelsToPrint.includes(level.toLowerCase())) {
    return
  }
  if (json) {
    process.stdout.write(`${formatJsonLine(entry)}\n`)
  } else {
    log(formatLogLine(entry, colorFn))
  }
}

export const logsCommand = async (options: OptionValues, command: BaseCommand) => {
  const client = command.netlify.api
  const { site, siteInfo } = command.netlify
  const siteId = site.id

  if (!siteId) {
    return logAndThrowError('You must link a project before viewing logs.')
  }

  const levelFlags = options.level as string[] | undefined
  if (levelFlags && !levelFlags.every((level) => LOG_LEVELS_LIST.includes(level))) {
    return logAndThrowError(`Invalid log level. Choices are: ${CLI_LOG_LEVEL_CHOICES_STRING.toString()}`)
  }
  const levelsToPrint: string[] = levelFlags ?? LOG_LEVELS_LIST
  const json = Boolean(options.json)
  const follow = Boolean(options.follow)

  if (follow && (options.since || options.until)) {
    return logAndThrowError('--follow cannot be used together with --since/--until.')
  }

  let sources: Source[]
  const rawSources = options.source as string[] | undefined
  const functionNames = (options.function as string[] | undefined) ?? []
  const edgeFunctionNames = (options.edgeFunction as string[] | undefined) ?? []

  if (rawSources) {
    try {
      sources = parseSources(rawSources)
    } catch (error) {
      return logAndThrowError((error as Error).message)
    }
  } else {
    sources = []
    if (functionNames.length > 0) {
      sources.push('functions')
    }
    if (edgeFunctionNames.length > 0) {
      sources.push('edge-functions')
    }
    if (sources.length === 0) {
      sources = ['functions', 'edge-functions']
    }
  }

  let deployId: string | undefined
  if (options.url) {
    try {
      deployId = await resolveDeployIdFromUrl(options.url as string, client, siteId, siteInfo)
    } catch (error) {
      const message = (error as Error).message
      if (message.includes("doesn't seem to match") && siteInfo.name) {
        const parts = [
          netlifyCommand(),
          'logs',
          ...(options.since ? [`--since ${options.since as string}`] : []),
          `--url https://${siteInfo.name}.netlify.app`,
        ].join(' ')
        return logAndThrowError(`${message}\nTry running ${chalk.cyan(parts)}`)
      }
      return logAndThrowError(message)
    }
  }

  const now = Date.now()
  let historicalRange: { from: number; to: number } | undefined
  if (!follow) {
    if (options.until && !options.since) {
      return logAndThrowError('--until requires --since to also be set.')
    }
    try {
      const fromValue = (options.since as string | undefined) ?? DEFAULT_SINCE
      const from = parseTimeValue(fromValue, now)
      const to = options.until ? parseTimeValue(options.until as string, now) : now
      if (from >= to) {
        return logAndThrowError('--since must be earlier than --until.')
      }
      historicalRange = { from, to }
    } catch (error) {
      return logAndThrowError((error as Error).message)
    }
  }

  if (!deployId && (sources.includes('edge-functions') || sources.includes('deploy'))) {
    if (follow && sources.includes('deploy')) {
      const buildingDeployId = await findCurrentBuildingDeploy(client, siteId)
      if (!buildingDeployId && sources.length === 1) {
        return logAndThrowError(
          'No active builds. Remove --source deploy or omit --follow to view historical deploy logs.',
        )
      }
      if (buildingDeployId) {
        deployId = buildingDeployId
      }
    }

    if (!deployId) {
      const latestId = await findLatestReadyDeploy(client, siteId)
      if (latestId) {
        deployId = latestId
      }
    }
  }

  const apiBase = client.basePath

  const sinceValue = (options.since as string | undefined) ?? DEFAULT_SINCE
  const untilValue = options.until as string | undefined

  if (historicalRange) {
    await runHistoricalMode({
      sources,
      client,
      apiBase,
      siteId,
      accessToken: client.accessToken,
      deployId,
      functionNames,
      edgeFunctionNames,
      from: historicalRange.from,
      to: historicalRange.to,
      levelsToPrint,
      json,
      timeDescription: humanizeTimeRange(sinceValue, untilValue),
    })
    return
  }

  if (!json) {
    printHeader(sources, '', true)
  }

  await runFollowMode({
    sources,
    client,
    siteId,
    accessToken: client.accessToken,
    deployId,
    functionNames,
    edgeFunctionNames,
    levelsToPrint,
    json,
  })
}

const runHistoricalMode = async ({
  sources,
  client,
  apiBase,
  siteId,
  accessToken,
  deployId,
  functionNames,
  edgeFunctionNames,
  from,
  to,
  levelsToPrint,
  json,
  timeDescription,
}: {
  sources: Source[]
  client: NetlifyAPI
  apiBase: string
  siteId: string
  accessToken: string | null | undefined
  deployId?: string
  functionNames: string[]
  edgeFunctionNames: string[]
  from: number
  to: number
  levelsToPrint: string[]
  json: boolean
  timeDescription: string
}) => {
  const allEntries: LogEntry[] = []

  if (sources.includes('deploy') && deployId) {
    const deployEntries = await fetchDeployHistoricalLogs({
      apiBase,
      accessToken,
      deployId,
      from,
      to,
    })
    allEntries.push(...deployEntries)
  }

  if (sources.includes('functions')) {
    const allFunctions = await listFunctions(client, siteId, deployId)
    if (allFunctions.length > 0) {
      const selected = selectFunctions(allFunctions, functionNames)
      const entries = await fetchFunctionHistoricalLogs({
        functions: selected,
        siteId,
        accessToken,
        from,
        to,
        deployId,
      })
      allEntries.push(...entries)
    }
  }

  if (sources.includes('edge-functions')) {
    const entries = await fetchEdgeFunctionHistoricalLogs({
      siteId,
      accessToken,
      from,
      to,
      deployId,
      filterNames: edgeFunctionNames,
    })
    allEntries.push(...entries)
  }

  const deployEntries = allEntries.filter((e) => e.source === 'deploy').sort((a, b) => a.ts - b.ts)
  const otherEntries = allEntries.filter((e) => e.source !== 'deploy').sort((a, b) => a.ts - b.ts)
  const sorted = [...deployEntries, ...otherEntries]

  if (sorted.length === 0) {
    log('No logs found for the given time range.')
    return
  }

  if (!json) {
    printHeader(sources, timeDescription, false)
  }

  const colorMap = new Map<string, (text: string) => string>()
  for (const entry of sorted) {
    const key = `${entry.source}:${entry.name}`
    if (!colorMap.has(key)) {
      colorMap.set(key, colorForLabel(key))
    }
  }

  for (const entry of sorted) {
    const key = `${entry.source}:${entry.name}`
    printEntry(entry, levelsToPrint, json, colorMap.get(key))
  }
}

const runFollowMode = async ({
  sources,
  client,
  siteId,
  accessToken,
  deployId,
  functionNames,
  edgeFunctionNames,
  levelsToPrint,
  json,
}: {
  sources: Source[]
  client: NetlifyAPI
  siteId: string
  accessToken: string | null | undefined
  deployId?: string
  functionNames: string[]
  edgeFunctionNames: string[]
  levelsToPrint: string[]
  json: boolean
}) => {
  const colorMap = new Map<string, (text: string) => string>()

  const getColor = (entry: LogEntry): ((text: string) => string) => {
    const key = `${entry.source}:${entry.name}`
    let colorFn = colorMap.get(key)
    if (!colorFn) {
      colorFn = colorForLabel(key)
      colorMap.set(key, colorFn)
    }
    return colorFn
  }

  const onEntry = (entry: LogEntry) => {
    printEntry(entry, levelsToPrint, json, getColor(entry))
  }

  if (sources.includes('deploy') && deployId) {
    const buildingDeployId = await findCurrentBuildingDeploy(client, siteId)
    if (buildingDeployId) {
      streamDeploy(siteId, buildingDeployId, accessToken, onEntry, () => {
        if (!json) {
          log(chalk.dim('Deploy stream closed.'))
        }
      })
    }
  }

  if (sources.includes('functions')) {
    const allFunctions = await listFunctions(client, siteId, deployId)
    if (allFunctions.length > 0) {
      try {
        const selected = selectFunctions(allFunctions, functionNames)
        if (functionNames.length === 0) {
          validateFunctionCount(selected.length)
        }
        streamFunctions(selected, siteId, accessToken, onEntry)
      } catch (error) {
        return logAndThrowError((error as Error).message)
      }
    }
  }

  if (sources.includes('edge-functions') && deployId) {
    streamEdgeFunctions(siteId, deployId, accessToken, edgeFunctionNames, onEntry)
  }
}
