import parseDuration from 'parse-duration'

import { chalk } from '../../utils/command-helpers.js'

import { LOG_LEVELS } from './log-levels.js'

export const ANALYTICS_API_BASE = 'https://analytics.services.netlify.com'

export interface HistoricalLogEntry {
  ts: number
  type: string
  message: string
  request_id?: string
  netlify_request_id?: string
  level: string
}

const DURATION_LIKE_RE = /^\d+(\.\d+)?\s*[a-z]/i

export const parseTimeValue = (input: string, now: number = Date.now()): number => {
  const trimmed = input.trim()

  // ISO 8601 timestamps contain hyphens; durations never do. If the input looks
  // like a duration (starts with a number followed by unit letters) and has no
  // hyphens, parse it as a duration relative to now.
  if (DURATION_LIKE_RE.test(trimmed) && !trimmed.includes('-')) {
    const duration = parseDuration(trimmed)
    if (typeof duration === 'number' && duration > 0) {
      return now - duration
    }
  }

  const ms = new Date(trimmed).getTime()
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid time value: "${input}". Use a duration (e.g. 10m, 1h, 24h, 2d) or an ISO 8601 timestamp.`,
    )
  }
  return ms
}

export const buildFunctionLogsUrl = ({
  siteId,
  branch,
  functionName,
}: {
  siteId: string
  branch?: string | null
  functionName: string
}): string => {
  const branchPath = branch ? `branch/${encodeURIComponent(branch)}/` : ''
  return `${ANALYTICS_API_BASE}/v2/sites/${encodeURIComponent(siteId)}/${branchPath}function_logs/${encodeURIComponent(functionName)}`
}

export const buildEdgeFunctionLogsUrl = ({ siteId }: { siteId: string }): string =>
  `${ANALYTICS_API_BASE}/v2/sites/${encodeURIComponent(siteId)}/edge_function_logs`

export const fetchHistoricalLogs = async ({
  baseUrl,
  accessToken,
  from,
  to,
  deployId,
}: {
  baseUrl: string
  accessToken: string | null | undefined
  from: number
  to: number
  deployId?: string
}): Promise<HistoricalLogEntry[]> => {
  const entries: HistoricalLogEntry[] = []
  let cursor: string | undefined

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

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken ?? ''}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`)
    }

    const body = (await response.json()) as { logs?: HistoricalLogEntry[]; pagination?: { next?: string } }
    entries.push(...(body.logs ?? []))
    cursor = body.pagination?.next
  } while (cursor)

  return entries
}

const colorLevel = (level: string): string => {
  switch (level) {
    case LOG_LEVELS.INFO:
      return chalk.blueBright(level)
    case LOG_LEVELS.WARN:
      return chalk.yellowBright(level)
    case LOG_LEVELS.ERROR:
      return chalk.redBright(level)
    default:
      return level
  }
}

export const formatLogLine = ({
  level,
  message,
  prefix,
  timestamp,
}: {
  level: string
  message: string
  prefix?: string
  timestamp?: number
}): string => {
  const effectiveLevel = level || LOG_LEVELS.INFO
  const prefixStr = prefix ? `${chalk.cyan(prefix)} ` : ''
  const timestampStr =
    typeof timestamp === 'number' && Number.isFinite(timestamp) ? `${chalk.dim(new Date(timestamp).toISOString())} ` : ''
  return `${prefixStr}${timestampStr}${colorLevel(effectiveLevel)} ${message}`
}
