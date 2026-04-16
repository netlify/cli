import type { NetlifyAPI } from '@netlify/api'
import parseDuration from 'parse-duration'

import { chalk } from '../../utils/command-helpers.js'

import { LOG_LEVELS } from './log-levels.js'

export const ANALYTICS_API_BASE = 'https://analytics.services.netlify.com'
export const DEPLOY_ID_RE = /^[a-f0-9]{24}$/

export const SOURCE_INDICATORS: Record<LogEntry['source'], string> = {
  function: '𝒇',
  'edge-function': '🌐',
  deploy: '🚀',
}

export const SOURCE_LABELS: Record<LogEntry['source'], string> = {
  function: 'Function',
  'edge-function': 'Edge function',
  deploy: 'Deploy',
}

export interface LogEntry {
  source: 'function' | 'edge-function' | 'deploy'
  name: string
  ts: number
  level: string
  message: string
  section?: string
}

export interface HistoricalLogEntry {
  ts: number
  type: string
  message: string
  request_id?: string
  netlify_request_id?: string
  level: string
  section?: string
  function?: string
  request_path?: string
}

const DURATION_LIKE_RE = /^\d+(\.\d+)?\s*[a-z]/i

export const parseTimeValue = (input: string, now: number = Date.now()): number => {
  const trimmed = input.trim()

  if (DURATION_LIKE_RE.test(trimmed) && !trimmed.includes('-')) {
    const duration = parseDuration(trimmed)
    if (typeof duration === 'number' && duration > 0) {
      return now - duration
    }
  }

  const ms = new Date(trimmed).getTime()
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid time value: "${input}". Use a duration (e.g. 10m, 1h, 24h, 2d) or an ISO 8601 timestamp.`)
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
  return `${ANALYTICS_API_BASE}/v2/sites/${encodeURIComponent(siteId)}/${branchPath}function_logs/${encodeURIComponent(
    functionName,
  )}`
}

export const buildEdgeFunctionLogsUrl = ({ siteId, search }: { siteId: string; search?: string }): string => {
  const base = `${ANALYTICS_API_BASE}/v2/sites/${encodeURIComponent(siteId)}/edge_function_logs`
  if (search) {
    return `${base}?search=${encodeURIComponent(search)}`
  }
  return base
}

const isDebug = () => Boolean(process.env.DEBUG)

const debugLog = (message: string) => {
  if (isDebug()) {
    process.stderr.write(`${chalk.dim(`[debug] ${message}`)}\n`)
  }
}

export const debugFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  debugLog(`→ ${init?.method ?? 'GET'} ${url}`)
  const start = performance.now()
  const response = await fetch(url, init)
  const elapsed = (performance.now() - start).toFixed(0)
  debugLog(`← ${response.status.toString()} ${response.statusText} (${elapsed}ms)`)
  return response
}

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
    const parsedUrl = new URL(baseUrl)
    parsedUrl.searchParams.set('from', String(from))
    parsedUrl.searchParams.set('to', String(to))
    if (deployId) {
      parsedUrl.searchParams.set('deploy_id', deployId)
    }
    if (cursor) {
      parsedUrl.searchParams.set('cursor', cursor)
    }

    const response = await debugFetch(parsedUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken ?? ''}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.status.toString()} ${response.statusText}`)
    }

    const body = (await response.json()) as { logs?: HistoricalLogEntry[]; pagination?: { next?: string } }
    entries.push(...(body.logs ?? []))
    cursor = body.pagination?.next
  } while (cursor)

  return entries
}

const PREFIX_COLORS = [
  chalk.cyan,
  chalk.magenta,
  chalk.yellow,
  chalk.green,
  chalk.blue,
  chalk.red,
  chalk.yellowBright,
  chalk.greenBright,
  chalk.magentaBright,
  chalk.cyanBright,
]

const hashString = (str: string): number => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export const colorForLabel = (label: string): ((text: string) => string) =>
  PREFIX_COLORS[hashString(label) % PREFIX_COLORS.length]

const colorLevel = (level: string): string => {
  switch (level.toUpperCase()) {
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

export const formatLogLine = (entry: LogEntry, colorFn?: (text: string) => string): string => {
  const level = entry.level || 'INFO'
  const indicator = SOURCE_INDICATORS[entry.source]
  const label = `[${indicator} ${entry.name}]`
  const prefix = colorFn ? colorFn(label) : chalk.cyan(label)
  const timestampStr = Number.isFinite(entry.ts) ? `${chalk.dim(new Date(entry.ts).toISOString())} ` : ''
  return `${prefix} ${timestampStr}${colorLevel(level)} ${entry.message}`
}

export const formatJsonLine = (entry: LogEntry): string =>
  JSON.stringify({
    source: entry.source,
    name: entry.name,
    timestamp: new Date(entry.ts).toISOString(),
    level: (entry.level || 'info').toLowerCase(),
    message: entry.message,
    ...(entry.section ? { section: entry.section } : {}),
  })

export const hostnamesForSite = (siteInfo: {
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

export const resolveDeployIdFromUrl = async (
  urlInput: string,
  client: NetlifyAPI,
  siteId: string,
  siteInfo: {
    name?: string
    custom_domain?: string
    domain_aliases?: string[]
    url?: string
    ssl_url?: string
  },
): Promise<string | undefined> => {
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

  const deploys = (await client.listSiteDeploys({ siteId, branch: prefix, per_page: 20 })) as {
    id: string
    state: string
  }[]
  const ready = deploys.find((deploy) => deploy.state === 'ready')
  if (!ready) {
    throw new Error(`No ready deploys found for branch ${prefix}`)
  }
  return ready.id
}
