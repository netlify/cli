import type { OptionValues } from 'commander'
import AsciiTable from 'ascii-table'

import { chalk, logAndThrowError, log, logJson, type APIError } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import type { AgentRunner, AgentRunnerSession } from './types.js'
import { formatDuration, formatStatus, truncateText, getAgentName } from './utils.js'

interface AgentListOptions extends OptionValues {
  status?: string
  json?: boolean
}

export const agentsList = async (options: AgentListOptions, command: BaseCommand) => {
  const { api, site, siteInfo, apiOpts } = command.netlify

  await command.authenticate()

  const listSpinner = startSpinner({ text: 'Fetching agent tasks...' })

  try {
    const params = new URLSearchParams()
    params.set('site_id', site.id ?? '')
    params.set('page', '1')
    params.set('per_page', '50')

    if (options.status) {
      params.set('state', options.status)
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
    stopSpinner({ spinner: listSpinner })

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

    // Fetch agent info for each runner
    const agentInfo = new Map<string, string>()
    const agentSpinner = startSpinner({ text: 'Loading agent information...' })

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
              const { agent } = sessions[0].agent_config
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
      stopSpinner({ spinner: agentSpinner })
    } catch {
      // If parallel fetch fails entirely, continue without agent info
      stopSpinner({ spinner: agentSpinner, error: true })
    }

    // Create and populate table without colors for proper formatting
    const table = new AsciiTable(`Agent Tasks for ${siteInfo.name}`)
    table.setHeading('ID', 'STATUS', 'AGENT', 'PROMPT', 'BRANCH', 'DURATION', 'CREATED')

    agentRunners.forEach((runner) => {
      table.addRow(
        runner.id,
        (runner.state ?? 'unknown').toUpperCase(),
        getAgentName(agentInfo.get(runner.id) ?? 'unknown'),
        truncateText(runner.title ?? 'No title', 35),
        truncateText(runner.branch ?? 'unknown', 12),
        runner.done_at ? formatDuration(runner.created_at, runner.done_at) : formatDuration(runner.created_at),
        new Date(runner.created_at).toLocaleDateString(),
      )
    })

    // Apply colors to the table output
    let tableOutput = table.toString()

    // Create unique status mappings to avoid replacement conflicts
    const statusReplacements = new Set<string>()
    agentRunners.forEach((runner) => {
      const status = runner.state ?? 'unknown'
      statusReplacements.add(status)
    })

    // Apply color replacements
    statusReplacements.forEach((status) => {
      const plainStatus = status.toUpperCase()
      const coloredStatus = formatStatus(status)
      // Use word boundary regex to avoid partial matches
      const regex = new RegExp(`\\b${plainStatus}\\b`, 'g')
      tableOutput = tableOutput.replace(regex, coloredStatus)
    })

    log(tableOutput)

    log('')
    log(chalk.dim(`Total: ${agentRunners.length.toString()} agent task(s)`))
    log('')
    log(`${chalk.dim('Use')} ${chalk.cyan('netlify agents:show <id>')} ${chalk.dim('to view details')}`)

    return agentRunners
  } catch (error_) {
    stopSpinner({ spinner: listSpinner, error: true })
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
