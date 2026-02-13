import { chalk, log } from '../../utils/command-helpers.js'
import { LOG_LEVELS } from './log-levels.js'

export function parseDateToMs(dateString: string): number {
  const ms = new Date(dateString).getTime()
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid date: ${dateString}`)
  }
  return ms
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

export function printHistoricalLogs(
  data: unknown,
  levelsToPrint: string[],
): void {
  const entries = Array.isArray(data) ? data : []

  if (entries.length === 0) {
    log('No logs found for the specified time range')
    return
  }

  for (const entry of entries) {
    const level = (entry.level ?? '').toLowerCase()
    if (levelsToPrint.length > 0 && !levelsToPrint.includes(level)) {
      continue
    }
    log(formatLogEntry(entry))
  }
}
