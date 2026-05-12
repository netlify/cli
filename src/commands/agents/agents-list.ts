import type { OptionValues } from 'commander'
import AsciiTable from 'ascii-table'

import { chalk, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'
import type { AgentRunner, ListAgentRunnersFilters } from './types.js'
import { formatDuration, formatStatus, isListStatusFilter, truncateText, validateListStatusFilter } from './utils.js'

interface AgentListOptions extends OptionValues {
  status?: string
  json?: boolean
  ndjson?: boolean
  branch?: string
  user?: string
  title?: string
  since?: string
  until?: string
  page?: string
  perPage?: string
  account?: string
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

const toUnixSeconds = (input?: string): number | undefined => {
  if (!input) return undefined
  if (!ISO_DATE_PATTERN.test(input)) {
    throw new Error(`Invalid date "${input}". Use an ISO timestamp like 2026-05-01T00:00:00Z.`)
  }
  const parsed = Date.parse(input)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid date "${input}". Use an ISO timestamp like 2026-05-01T00:00:00Z.`)
  }
  return Math.floor(parsed / 1000)
}

const parsePositiveInt = (input: string | undefined, name: string): number | undefined => {
  if (input === undefined) return undefined
  if (!/^[1-9]\d*$/.test(input)) {
    throw new Error(`--${name} must be a positive integer`)
  }
  return Number.parseInt(input, 10)
}

const MAX_PER_PAGE = 100

const buildFilters = (options: AgentListOptions): ListAgentRunnersFilters => {
  const filters: ListAgentRunnersFilters = {}
  if (options.status) {
    const valid = validateListStatusFilter(options.status)
    if (valid !== true) throw new Error(valid)
    if (isListStatusFilter(options.status)) filters.state = options.status
  }
  if (options.branch) filters.branch = options.branch
  if (options.user) filters.user_id = options.user
  if (options.title) filters.title = options.title
  filters.from = toUnixSeconds(options.since)
  filters.to = toUnixSeconds(options.until)
  filters.page = parsePositiveInt(options.page, 'page')
  const perPage = parsePositiveInt(options.perPage, 'per-page')
  if (perPage !== undefined && perPage > MAX_PER_PAGE) {
    throw new Error(
      `--per-page must be ${MAX_PER_PAGE.toString()} or fewer (the server caps at ${MAX_PER_PAGE.toString()})`,
    )
  }
  filters.per_page = perPage
  return filters
}

export const agentsList = async (options: AgentListOptions, command: BaseCommand) => {
  const { site, siteInfo } = command.netlify

  await command.authenticate()

  const api = createAgentsApi(command.netlify)
  let filters: ListAgentRunnersFilters
  try {
    filters = buildFilters(options)
  } catch (error_) {
    return logAndThrowError((error_ as Error).message)
  }

  if (options.account) {
    const droppedFilters = ['branch', 'since', 'until'].filter((key) => options[key as keyof AgentListOptions])
    if (droppedFilters.length > 0) {
      log(chalk.yellow(`⚠ --${droppedFilters.join(', --')} are ignored when --account is set.`))
    }
  }

  const spinner = startSpinner({ text: 'Fetching agent tasks...' })

  try {
    const result = options.account
      ? await api.listAgentRunnersForAccount(options.account, filters)
      : await api.listAgentRunners(site.id ?? '', filters)
    stopSpinner({ spinner })

    if (options.json) {
      logJson(result.data)
      return result.data
    }

    if (options.ndjson) {
      for (const runner of result.data) {
        process.stdout.write(`${JSON.stringify(runner)}\n`)
      }
      return result.data
    }

    if (result.data.length === 0) {
      const emptyScope = options.account ? `account ${options.account}` : 'this site'
      log(chalk.yellow(`No agent tasks found for ${emptyScope}.`))
      log()
      log(`Create your first agent task with:`)
      log(`  ${chalk.cyan('netlify agents:create')}`)
      return result.data
    }

    const isGitBased = Boolean(siteInfo.build_settings?.repo_branch)
    const scope = options.account ? `account ${options.account}` : siteInfo.name
    const table = new AsciiTable(`Agent Tasks for ${scope}`)
    // Account-wide listing spans multiple sites, so we can't infer a single base column from the linked site.
    const baseColumnLabel = options.account ? 'BRANCH/BASE' : isGitBased ? 'BRANCH' : 'BASE'
    table.setHeading('ID', 'STATUS', 'PROMPT', baseColumnLabel, 'DURATION', 'CREATED')

    for (const runner of result.data) {
      const baseValue = options.account
        ? runner.branch
          ? truncateText(runner.branch, 12)
          : 'Production'
        : isGitBased
        ? truncateText(runner.branch ?? 'unknown', 12)
        : 'Production'
      table.addRow(
        runner.id,
        (runner.state ?? 'unknown').toUpperCase(),
        truncateText(runner.title ?? 'No title', 35),
        baseValue,
        runner.done_at ? formatDuration(runner.created_at, runner.done_at) : formatDuration(runner.created_at),
        new Date(runner.created_at).toISOString().slice(0, 10),
      )
    }

    log(colorizeStatuses(table.toString(), result.data))
    log()
    log(
      chalk.dim(formatPaginationFooter(result.data.length, result.total, result.page, result.perPage, result.hasNext)),
    )
    log()
    log(`${chalk.dim('Use')} ${chalk.cyan('netlify agents:show <id>')} ${chalk.dim('to view details')}`)

    return result.data
  } catch (error_) {
    const error = error_ as Error & { status?: number }
    stopSpinner({ spinner, error: true })
    if (options.account && error.status === 404) {
      return logAndThrowError(
        `Agent tasks are not available for account "${options.account}". Check that the slug is correct and that your account has access to agent tasks.`,
      )
    }
    return logAndThrowError(`Failed to list agent tasks: ${error.message}`)
  }
}

const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const colorizeStatuses = (tableOutput: string, runners: AgentRunner[]): string => {
  let output = tableOutput
  const statuses = new Set(runners.map((runner) => runner.state ?? 'unknown'))
  for (const status of statuses) {
    const plain = status.toUpperCase()
    const colored = formatStatus(status)
    output = output.replace(new RegExp(`\\b${escapeRegex(plain)}\\b`, 'g'), colored)
  }
  return output
}

const formatPaginationFooter = (
  shown: number,
  total: number | undefined,
  page: number,
  perPage: number,
  hasNext: boolean,
): string => {
  const lines: string[] = []
  if (total != null) {
    const start = (page - 1) * perPage + 1
    const end = (page - 1) * perPage + shown
    lines.push(`Showing ${start.toString()}-${end.toString()} of ${total.toString()} task(s)`)
  } else {
    lines.push(`Showing ${shown.toString()} task(s)`)
  }
  if (hasNext) {
    lines.push(`Use --page ${(page + 1).toString()} to see the next page`)
  }
  return lines.join(' • ')
}
