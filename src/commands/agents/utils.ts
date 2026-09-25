import path from 'path'

import { chalk } from '../../utils/command-helpers.js'
import { AGENT_TO_PROVIDER, AVAILABLE_AGENTS, LIST_STATUS_FILTERS, STATUS_COLORS } from './constants.js'
import type { ListStatusFilter } from './constants.js'
import type { AgentsApi } from './api.js'
import type { AvailableAgent } from './constants.js'
import type { AgentRunnerSessionUsage } from './types.js'

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString()
}

export const formatDuration = (startTime: string, endTime?: string): string => {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : new Date()
  const duration = end.getTime() - start.getTime()

  const hours = Math.floor(duration / 3600000)
  const minutes = Math.floor((duration % 3600000) / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)

  if (hours > 0) {
    return `${hours.toString()}h ${minutes.toString()}m ${seconds.toString()}s`
  }
  if (minutes > 0) {
    return `${minutes.toString()}m ${seconds.toString()}s`
  }
  return `${seconds.toString()}s`
}

export const formatStatus = (status: string): string => {
  const colorFn = status in STATUS_COLORS ? STATUS_COLORS[status as keyof typeof STATUS_COLORS] : chalk.white
  return colorFn(status.toUpperCase())
}

const PR_STATE_LABELS: Record<string, string> = {
  open: 'Open',
  draft: 'Draft',
  closed: 'Closed',
  merged: 'Merged',
}

export const formatPrState = (state: string): string => PR_STATE_LABELS[state.toLowerCase()] ?? state

export const validatePrompt = (input: string): true | string => {
  if (!input || input.trim().length === 0) {
    return 'Please provide a prompt for the agent'
  }
  if (input.trim().length < 5) {
    return 'Please provide a more detailed prompt (at least 5 characters)'
  }
  return true
}

export const TITLE_MAX_LENGTH = 200

const UNICODE_TAG_PATTERN = /[\u{E0000}-\u{E007F}]/gu
const CONTROL_CHAR_PATTERN = /\p{Cc}/gu

export const sanitizePromptText = (text: string): string => text.replace(UNICODE_TAG_PATTERN, '')

export const sanitizeRunnerTitle = (title: string): string =>
  sanitizePromptText(title).replace(CONTROL_CHAR_PATTERN, '').trim()

export const validateRunnerTitle = (title: string): true | string => {
  const sanitized = sanitizeRunnerTitle(title)
  if (!sanitized) return 'A non-empty title is required'
  if (sanitized.length > TITLE_MAX_LENGTH) return `Title must be ${TITLE_MAX_LENGTH.toString()} characters or fewer`
  return true
}

export const validateAgent = (agent: string): true | string => {
  const validAgents = AVAILABLE_AGENTS.map((entry) => entry.value) as string[]
  if (!validAgents.includes(agent)) {
    return `Invalid agent. Available agents: ${validAgents.join(', ')}`
  }
  return true
}

export const isListStatusFilter = (status: string): status is ListStatusFilter =>
  (LIST_STATUS_FILTERS as readonly string[]).includes(status)

export const validateListStatusFilter = (status: string): true | string => {
  if (isListStatusFilter(status)) return true
  return `--status accepts only ${LIST_STATUS_FILTERS.map((entry) => `"${entry}"`).join(', ')}`
}

export const checkModelAvailability = async (
  api: AgentsApi,
  agent: AvailableAgent,
  model: string,
): Promise<true | string> => {
  let providers
  try {
    providers = await api.listAiGatewayProviders()
  } catch {
    return true
  }
  const providerName = AGENT_TO_PROVIDER[agent]
  const models = providers.providers[providerName]?.models
  if (!models) return true
  if (models.includes(model)) return true
  return `Unknown model "${model}" for agent "${agent}". Known ${providerName} models: ${models.join(
    ', ',
  )}. Pass through if a newer one has rolled out.`
}

export const getAgentName = (agent: string): string => {
  const entry = AVAILABLE_AGENTS.find((candidate) => candidate.value === agent)
  return entry ? entry.name : agent
}

const NETLIFY_WEB_UI = (process.env.NETLIFY_WEB_UI ?? 'https://app.netlify.com').replace(/\/+$/, '')

export const buildAgentDashboardUrl = (siteName: string, agentId: string): string =>
  `${NETLIFY_WEB_UI}/projects/${siteName}/agent-runs/${agentId}`

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes.toString()} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export const formatTokenCount = (count?: number): string => {
  if (count == null) return '-'
  if (count < 1000) return count.toString()
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}k`
  return `${(count / 1_000_000).toFixed(2)}M`
}

export const formatUsage = (usage?: AgentRunnerSessionUsage): string[] => {
  if (!usage) return []
  const lines: string[] = []
  const tokens = usage.total_tokens
  if (tokens != null) {
    const breakdown = [
      usage.total_input_tokens != null ? `in ${formatTokenCount(usage.total_input_tokens)}` : null,
      usage.total_output_tokens != null ? `out ${formatTokenCount(usage.total_output_tokens)}` : null,
      usage.total_cached_input_tokens || usage.total_cached_output_tokens
        ? `cached ${formatTokenCount((usage.total_cached_input_tokens ?? 0) + (usage.total_cached_output_tokens ?? 0))}`
        : null,
    ].filter(Boolean)
    lines.push(`Tokens: ${formatTokenCount(tokens)}${breakdown.length > 0 ? ` (${breakdown.join(', ')})` : ''}`)
  }
  if (usage.total_credits_cost != null) {
    lines.push(`Credits: ${usage.total_credits_cost.toFixed(4)}`)
  }
  return lines
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.log': 'text/plain',
  '.json': 'application/json',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
  '.toml': 'application/toml',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.jsx': 'text/javascript',
  '.css': 'text/css',
}

export const getMimeType = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase()
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

export const formatDiff = (diff: string): string => {
  if (!diff) return ''
  const lines = diff.split('\n')
  return lines
    .map((line) => {
      if (line.startsWith('diff --git') || line.startsWith('index ')) return chalk.bold(line)
      if (line.startsWith('--- ') || line.startsWith('+++ ')) return chalk.bold(line)
      if (line.startsWith('@@')) return chalk.cyan(line)
      if (line.startsWith('+')) return chalk.green(line)
      if (line.startsWith('-')) return chalk.red(line)
      return line
    })
    .join('\n')
}

export const parseLinkHeader = (linkHeader: string | null): Record<string, string> => {
  if (!linkHeader) return {}
  const result: Record<string, string> = {}
  for (const part of linkHeader.split(',')) {
    const match = /<([^>]+)>;\s*rel="([^"]+)"/.exec(part.trim())
    if (match) result[match[2]] = match[1]
  }
  return result
}
