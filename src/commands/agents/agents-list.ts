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
import type { AgentRunner, AgentRunnerSession } from './types.js'

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
    const params = new URLSearchParams()
    params.set('site_id', site.id ?? '')
    params.set('page', '1')
    params.set('per_page', '50')

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
      log(chalk.yellow('No agent tasks found for this site.'))
      log(``)
      log(`Create your first agent task with:`)
      log(`  ${chalk.cyan('netlify agents:create')}`)
      return
    }

    log(`${chalk.bold('Agent Tasks')} for ${chalk.cyan(siteInfo.name)}`)
    log(``)

    const header = [
      chalk.bold('ID'),
      chalk.bold('STATUS'),
      chalk.bold('AGENT'),
      chalk.bold('PROMPT'),
      chalk.bold('BRANCH'),
      chalk.bold('DURATION'),
      chalk.bold('CREATED'),
    ]

    const colWidths = [26, 10, 8, 35, 12, 10, 12]

    // Print header with proper alignment
    // eslint-disable-next-line no-control-regex
    const ansiRegex = /\x1b\[[0-9;]*m/g
    const headerRow = header
      .map((h, i) => {
        // Remove chalk formatting for length calculation
        const cleanHeader = h.replace(ansiRegex, '')
        return h + ' '.repeat(Math.max(0, colWidths[i] - cleanHeader.length))
      })
      .join(' ')
    log(headerRow)
    log('─'.repeat(headerRow.replace(ansiRegex, '').length))

    // Fetch agent info for each runner
    const agentInfo = new Map<string, string>()

    try {
      // Fetch latest session for each runner in parallel to get agent info
      const sessionPromises = agentRunners.map(async (runner) => {
        try {
          const sessionsResponse = await fetch(
            `${apiOpts.scheme ?? 'https'}://${apiOpts.host ?? api.host}/api/v1/agent_runners/${
              runner.id
            }/sessions?page=1&per_page=1`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${api.accessToken ?? ''}`,
                'User-Agent': apiOpts.userAgent,
              },
            },
          )

          if (sessionsResponse.ok) {
            const sessions = (await sessionsResponse.json()) as AgentRunnerSession[] | undefined
            if (sessions && sessions.length > 0 && sessions[0].agent_config) {
              const agent = (sessions[0].agent_config as { agent?: string }).agent
              if (agent) {
                agentInfo.set(runner.id, agent)
              }
            }
          }
        } catch {
          // Failed to fetch session for this runner, continue without agent info
        }
      })

      // Wait for all session fetches to complete
      await Promise.allSettled(sessionPromises)
    } catch {
      // If parallel fetch fails entirely, continue without agent info
    }

    // Print each agent runner
    agentRunners.forEach((runner) => {
      const id = chalk.cyan(runner.id)
      const status = formatStatus(runner.state ?? 'unknown')
      const agent = agentInfo.get(runner.id) ?? 'unknown'
      const prompt = chalk.dim(truncateText(runner.title ?? 'No title', colWidths[3] - 2))
      const branch = truncateText(runner.branch ?? 'unknown', colWidths[4] - 2)
      const duration = runner.done_at
        ? formatDuration(runner.created_at, runner.done_at)
        : formatDuration(runner.created_at)
      const created = new Date(runner.created_at).toLocaleDateString()

      // Align each column properly
      const columns = [id, status, agent, prompt, branch, duration, created]
      const alignedRow = columns
        .map((col, i) => {
          const cleanCol = col.replace(ansiRegex, '')
          return col + ' '.repeat(Math.max(0, colWidths[i] - cleanCol.length))
        })
        .join(' ')

      log(alignedRow)
    })

    log('')
    log(chalk.dim(`Total: ${agentRunners.length.toString()} agent task(s)`))
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

    return logAndThrowError(`Failed to list agent tasks: ${error.message}`)
  }
}
