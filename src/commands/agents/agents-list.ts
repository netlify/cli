import type { OptionValues } from 'commander'

import {
  chalk,
  logAndThrowError,
  log,
  logJson,
  type APIError,
  type ChalkInstance,
} from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'
import type { AgentRunner } from './types.js'

const formatDuration = (startTime: string, endTime?: string): string => {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : new Date()
  const duration = end.getTime() - start.getTime()

  const minutes = Math.floor(duration / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)

  if (minutes > 0) {
    return `${minutes.toString()}m ${seconds.toString()}s`
  }
  return `${seconds.toString()}s`
}

const formatStatus = (status: string): string => {
  const statusColors: Record<string, ChalkInstance> = {
    new: chalk.blue,
    running: chalk.yellow,
    done: chalk.green,
    error: chalk.red,
    cancelled: chalk.gray,
    archived: chalk.dim,
  }

  const colorFn = statusColors[status] ?? chalk.white

  return colorFn(status.toUpperCase())
}

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

interface AgentListOptions extends OptionValues {
  status?: string
  json?: boolean
}

export const agentsList = async (options: AgentListOptions, command: BaseCommand) => {
  const { api, site, siteInfo, apiOpts } = command.netlify

  await command.authenticate()

  try {
    // Build query parameters
    const params = new URLSearchParams()
    params.set('site_id', site.id ?? '')
    params.set('page', '1')
    params.set('per_page', '50') // Get more results for list view

    if (options.status) {
      params.set('status', options.status)
    }

    const response = await fetch(
      `${apiOpts.scheme ?? 'https'}://${apiOpts.host ?? api.host}/api/v1/agent_runners?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${api.accessToken ?? ''}`,
          'User-Agent': apiOpts.userAgent,
        },
      },
    )

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string }
      throw new Error(errorData.error ?? `HTTP ${response.status.toString()}: ${response.statusText}`)
    }

    const agentRunners = (await response.json()) as AgentRunner[] | null | undefined

    if (options.json) {
      logJson(agentRunners)
      return agentRunners
    }

    if (!agentRunners || agentRunners.length === 0) {
      log(chalk.yellow('No agent runners found for this site.'))
      log(``)
      log(`Create your first agent runner with:`)
      log(`  ${chalk.cyan('netlify agents:create')}`)
      return
    }

    // Display results in a table format
    log(`${chalk.bold('Agent Runners')} for ${chalk.cyan(siteInfo.name)}`)
    log(``)

    // Table header
    const header = [
      chalk.bold('ID'),
      chalk.bold('STATUS'),
      chalk.bold('AGENT'),
      chalk.bold('PROMPT'),
      chalk.bold('BRANCH'),
      chalk.bold('DURATION'),
      chalk.bold('CREATED'),
    ]

    // Calculate column widths
    const colWidths = [8, 10, 8, 40, 15, 10, 12]

    // Print header
    const headerRow = header.map((h, i) => h.padEnd(colWidths[i])).join(' ')
    log(headerRow)
    log('─'.repeat(headerRow.length))

    // Print each agent runner
    agentRunners.forEach((runner) => {
      const id = truncateText(runner.id, 8)
      const status = formatStatus(runner.state ?? 'unknown')
      const prompt = truncateText(runner.title ?? 'No title', 38).padEnd(colWidths[3])
      const branch = truncateText(runner.branch ?? 'main', 13).padEnd(colWidths[4])
      const duration = runner.done_at
        ? formatDuration(runner.created_at, runner.done_at).padEnd(colWidths[5])
        : formatDuration(runner.created_at).padEnd(colWidths[5])
      const created = new Date(runner.created_at).toLocaleDateString().padEnd(colWidths[6])

      const row = [chalk.cyan(id), status, chalk.dim(prompt), branch, duration, created].join(' ')

      log(row)
    })

    log('')
    log(chalk.dim(`Total: ${agentRunners.length.toString()} agent runner(s)`))
    log('')
    log(`${chalk.dim('Use')} ${chalk.cyan('netlify agents:show <id>')} ${chalk.dim('to view details')}`)

    return agentRunners
  } catch (error_) {
    const error = error_ as APIError | Error

    // Handle specific error cases
    if ('status' in error) {
      if (error.status === 401) {
        return logAndThrowError('Authentication failed. Please run `netlify login` to authenticate.')
      }
      if (error.status === 403) {
        return logAndThrowError('Permission denied. Make sure you have access to this site.')
      }
      if (error.status === 404) {
        return logAndThrowError('Site not found. Make sure the site exists and you have access to it.')
      }
    }

    return logAndThrowError(`Failed to list agent runners: ${error.message}`)
  }
}
