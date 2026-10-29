import { debugFetch } from '../log-api.js'
import type { LogEntry } from '../log-api.js'

interface ServerLogLine {
  timestamp: number
  severity: string
  body: string
  actor_id: string
}

// The API serves up to 500 lines a page and stops paging 10,000 lines back.
const PER_PAGE = 500
const MAX_PAGES = 1 + 10_000 / PER_PAGE

// Lines are stored a few seconds after their time, so each poll looks back
// this far and drops what the previous poll already returned.
const LOOK_BACK_MS = 10_000
const POLL_INTERVAL_MS = 2_000

// Retrying cannot change these answers, so following stops on them.
const PERMANENT_FAILURE_STATUSES = new Set([401, 403, 404])

// The API filters by at most one severity, and only these, though lines can
// carry other levels too.
const FILTERABLE_SEVERITIES = new Set(['error', 'warn', 'info'])

const severityFor = (levels: string[] | undefined) =>
  levels?.length === 1 && FILTERABLE_SEVERITIES.has(levels[0]) ? levels[0] : undefined

class ServerLogsRequestError extends Error {
  constructor(
    readonly status: number,
    statusText: string,
  ) {
    super(`Failed to fetch server logs: ${status.toString()} ${statusText}`)
  }
}

const lineKey = (line: ServerLogLine) => `${line.timestamp.toString()}|${line.actor_id}|${line.severity}|${line.body}`

const countKeys = (lines: ServerLogLine[]) => {
  const counts = new Map<string, number>()
  for (const line of lines) {
    const key = lineKey(line)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

const toEntry = (line: ServerLogLine): LogEntry => ({
  source: 'server',
  // The dashboard shows instances by the first 8 characters of their ID too.
  name: line.actor_id ? line.actor_id.slice(0, 8) : 'server',
  ts: line.timestamp,
  level: line.severity ? line.severity.toUpperCase() : 'INFO',
  message: line.body,
})

const fetchServerLogLines = async ({
  apiBase,
  siteId,
  accessToken,
  from,
  to,
  levels,
}: {
  apiBase: string
  siteId: string
  accessToken: string | null | undefined
  from: number
  to: number
  levels?: string[]
}): Promise<{ lines: ServerLogLine[]; truncated: boolean }> => {
  // The API pages newest first and sends millisecond timestamps, though it
  // orders by finer ones, so reversing is what keeps same-millisecond lines in order.
  const lines: ServerLogLine[] = []
  const severity = severityFor(levels)

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(`${apiBase}/sites/${encodeURIComponent(siteId)}/observability/server/logs`)
    url.searchParams.set('from_ts', String(from))
    url.searchParams.set('to_ts', String(to))
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', String(PER_PAGE))
    if (severity) {
      url.searchParams.set('severity', severity)
    }

    const response = await debugFetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken ?? ''}`,
      },
    })
    if (!response.ok) {
      throw new ServerLogsRequestError(response.status, response.statusText)
    }

    const body = (await response.json()) as { logs?: ServerLogLine[]; has_next_page?: boolean }
    lines.push(...(body.logs ?? []))
    if (!body.has_next_page) {
      return { lines: lines.reverse(), truncated: false }
    }
  }

  return { lines: lines.reverse(), truncated: true }
}

export const fetchServerHistoricalLogs = async (options: {
  apiBase: string
  siteId: string
  accessToken: string | null | undefined
  from: number
  to: number
  levels?: string[]
}): Promise<{ entries: LogEntry[]; truncated: boolean }> => {
  const { lines, truncated } = await fetchServerLogLines(options)
  return { entries: lines.map(toEntry), truncated }
}

export const streamServer = ({
  apiBase,
  siteId,
  accessToken,
  levels,
  onEntry,
  onError,
  intervalMs = POLL_INTERVAL_MS,
}: {
  apiBase: string
  siteId: string
  accessToken: string | null | undefined
  levels?: string[]
  onEntry: (entry: LogEntry) => void
  onError?: (error: Error) => void
  intervalMs?: number
}): (() => void) => {
  let newest = Date.now()
  let seen = new Map<string, number>()
  let failing = false
  let truncating = false
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const poll = async () => {
    try {
      const { lines, truncated } = await fetchServerLogLines({
        apiBase,
        siteId,
        accessToken,
        levels,
        from: newest - LOOK_BACK_MS,
        to: Date.now(),
      })
      if (stopped) {
        return
      }

      // Lines carry no ID, so identical ones are told apart by how many of them
      // the previous poll returned.
      const unclaimed = new Map(seen)
      const fresh = lines
        .filter((line) => {
          const key = lineKey(line)
          const count = unclaimed.get(key) ?? 0
          unclaimed.set(key, count - 1)
          return count <= 0
        })
        .sort((a, b) => a.timestamp - b.timestamp)
      for (const line of fresh) {
        onEntry(toEntry(line))
      }
      // The API pages newest first, so a truncated window loses its oldest lines for good.
      if (truncated && !truncating) {
        onError?.(new Error('Server logs are arriving faster than they can be shown, so some lines were skipped.'))
      }
      truncating = truncated

      // The next window starts inside this one, so only these lines can repeat.
      seen = countKeys(lines)
      newest = fresh.reduce((max, line) => Math.max(max, line.timestamp), newest)
      failing = false
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error))
      if (error instanceof ServerLogsRequestError && PERMANENT_FAILURE_STATUSES.has(error.status)) {
        stopped = true
        onError?.(failure)
        return
      }
      // The next poll's window still covers what this one missed, so a run of
      // failures is reported once.
      if (!failing) {
        failing = true
        onError?.(failure)
      }
    }

    if (!stopped) {
      timer = setTimeout(() => void poll(), intervalMs)
    }
  }

  void poll()

  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
