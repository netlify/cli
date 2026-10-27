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

class ServerLogsRequestError extends Error {
  constructor(
    readonly status: number,
    statusText: string,
  ) {
    super(`Failed to fetch server logs: ${status.toString()} ${statusText}`)
  }
}

const lineKey = (line: ServerLogLine) => `${line.timestamp.toString()}|${line.actor_id}|${line.severity}|${line.body}`

const toEntry = (line: ServerLogLine): LogEntry => ({
  source: 'server',
  name: line.actor_id || 'server',
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
}: {
  apiBase: string
  siteId: string
  accessToken: string | null | undefined
  from: number
  to: number
}): Promise<{ lines: ServerLogLine[]; truncated: boolean }> => {
  const lines: ServerLogLine[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(`${apiBase}/sites/${encodeURIComponent(siteId)}/observability/server/logs`)
    url.searchParams.set('from_ts', String(from))
    url.searchParams.set('to_ts', String(to))
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', String(PER_PAGE))

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
      return { lines, truncated: false }
    }
  }

  return { lines, truncated: true }
}

export const fetchServerHistoricalLogs = async (options: {
  apiBase: string
  siteId: string
  accessToken: string | null | undefined
  from: number
  to: number
}): Promise<{ entries: LogEntry[]; truncated: boolean }> => {
  const { lines, truncated } = await fetchServerLogLines(options)
  return { entries: lines.map(toEntry), truncated }
}

export const streamServer = ({
  apiBase,
  siteId,
  accessToken,
  onEntry,
  onError,
  intervalMs = POLL_INTERVAL_MS,
}: {
  apiBase: string
  siteId: string
  accessToken: string | null | undefined
  onEntry: (entry: LogEntry) => void
  onError?: (error: Error) => void
  intervalMs?: number
}): (() => void) => {
  let newest = Date.now()
  let seen = new Set<string>()
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const poll = async () => {
    try {
      const { lines } = await fetchServerLogLines({
        apiBase,
        siteId,
        accessToken,
        from: newest - LOOK_BACK_MS,
        to: Date.now(),
      })
      if (stopped) {
        return
      }

      const fresh = lines.filter((line) => !seen.has(lineKey(line))).sort((a, b) => a.timestamp - b.timestamp)
      for (const line of fresh) {
        onEntry(toEntry(line))
      }

      // The next window starts inside this one, so only these lines can repeat.
      seen = new Set(lines.map(lineKey))
      newest = fresh.reduce((max, line) => Math.max(max, line.timestamp), newest)
    } catch (error) {
      if (error instanceof ServerLogsRequestError && PERMANENT_FAILURE_STATUSES.has(error.status)) {
        stopped = true
        onError?.(error)
        return
      }
      // Otherwise the next poll's window still covers what this one missed.
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
