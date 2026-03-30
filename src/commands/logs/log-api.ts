import { chalk, log } from '../../utils/command-helpers.js'
import { LOG_LEVELS } from './log-levels.js'

export function parseDateToMs(dateString: string): number {
  const ms = new Date(dateString).getTime()
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid date: ${dateString}`)
  }
  return ms
}

const ANALYTICS_BASE_URL = 'https://analytics.services.netlify.com/v2/sites'

export function buildFunctionLogsUrl({
  siteId,
  branch,
  functionName,
  from,
  to,
}: {
  siteId: string
  branch: string
  functionName: string
  from: number
  to: number
}): string {
  return `${ANALYTICS_BASE_URL}/${encodeURIComponent(siteId)}/branch/${encodeURIComponent(branch)}/function_logs/${encodeURIComponent(functionName)}?from=${from.toString()}&to=${to.toString()}`
}

export function buildEdgeFunctionLogsUrl({
  siteId,
  from,
  to,
}: {
  siteId: string
  from: number
  to: number
}): string {
  return `${ANALYTICS_BASE_URL}/${encodeURIComponent(siteId)}/edge_function_logs?from=${from.toString()}&to=${to.toString()}`
}

export async function fetchHistoricalLogs({
  url,
  accessToken,
}: {
  url: string
  accessToken: string
}): Promise<unknown> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(errorData.error ?? `HTTP ${response.status.toString()}: ${response.statusText}`)
  }

  return response.json()
}

export function formatLogEntry(entry: { timestamp?: string; level?: string; message?: string }): string {
  const timestamp = entry.timestamp ? new Date(entry.timestamp).toISOString() : ''
  let levelString = entry.level ?? ''

  switch (levelString.toUpperCase()) {
    case LOG_LEVELS.INFO:
      levelString = chalk.blueBright(levelString)
      break
    case LOG_LEVELS.WARN:
      levelString = chalk.yellowBright(levelString)
      break
    case LOG_LEVELS.ERROR:
      levelString = chalk.redBright(levelString)
      break
    default:
      break
  }

  const parts = [timestamp, levelString, entry.message ?? ''].filter(Boolean)
  return parts.join(' ')
}

export function printHistoricalLogs(data: unknown, levelsToPrint: string[]): void {
  const entries = Array.isArray(data) ? (data as { timestamp?: string; level?: string; message?: string }[]) : []
  const normalizedLevels = levelsToPrint.map((level) => level.toLowerCase())

  if (entries.length === 0) {
    log('No logs found for the specified time range')
    return
  }

  for (const entry of entries) {
    const level = (entry.level ?? '').toLowerCase()
    if (normalizedLevels.length > 0 && !normalizedLevels.includes(level)) {
      continue
    }
    log(formatLogEntry(entry))
  }
}
