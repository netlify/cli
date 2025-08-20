import type { OptionValues } from 'commander'

import { chalk, logAndThrowError, log, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import type { AgentRunner, AgentRunnerSession } from './types.js'
import { formatDate, formatDuration, formatStatus, getAgentName } from './utils.js'

interface AgentShowOptions extends OptionValues {
  json?: boolean
}

export const agentsShow = async (id: string, options: AgentShowOptions, command: BaseCommand) => {
  const { api, site, siteInfo, apiOpts } = command.netlify

  await command.authenticate()

  if (!id) {
    return logAndThrowError('Agent task ID is required')
  }

  const showSpinner = startSpinner({ text: 'Fetching agent task details...' })

  try {
    const response = await fetch(
      `${apiOpts.scheme ?? 'https'}://${apiOpts.host ?? api.host}/api/v1/agent_runners/${id}`,
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

    const agentRunner = (await response.json()) as AgentRunner
    stopSpinner({ spinner: showSpinner })

    if (options.json) {
      logJson(agentRunner)
      return agentRunner
    }

    // Display detailed information
    log(chalk.bold('Agent Task Details'))
    log(``)

    log(chalk.bold('Basic Information:'))
    log(`  Task ID: ${chalk.cyan(agentRunner.id)}`)
    log(`  Status: ${formatStatus(agentRunner.state ?? 'unknown')}`)
    log(`  Site: ${chalk.cyan(siteInfo.name)} (${site.id ?? ''})`)

    if (agentRunner.user) {
      log(`  Created by: ${agentRunner.user.full_name ?? 'Anonymous'}`)
    }

    // Fetch sessions to get agent information
    let sessions: AgentRunnerSession[] | undefined
    try {
      const sessionsResponse = await fetch(
        `${apiOpts.scheme ?? 'https'}://${
          apiOpts.host ?? api.host
        }/api/v1/agent_runners/${id}/sessions?page=1&per_page=5`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${api.accessToken ?? ''}`,
            'User-Agent': apiOpts.userAgent,
          },
        },
      )

      if (sessionsResponse.ok) {
        sessions = (await sessionsResponse.json()) as AgentRunnerSession[] | undefined
      }
    } catch {
      // Sessions fetch failed, but continue without session data
    }

    log(``)
    log(chalk.bold('Configuration:'))

    // Display agent information from latest session
    if (sessions && sessions.length > 0) {
      const latestSession = sessions[0]
      if (latestSession.agent_config) {
        const { agent, model } = latestSession.agent_config

        if (agent) {
          log(`  Agent: ${chalk.cyan(getAgentName(agent))}`)
        }
        if (model) {
          log(`  Model: ${chalk.cyan(model)}`)
        }
      }
    }

    log(`  Branch: ${chalk.cyan(agentRunner.branch ?? 'unknown')}`)

    if (agentRunner.result_branch) {
      log(`  Result Branch: ${chalk.green(agentRunner.result_branch)}`)
    }

    log(``)
    log(chalk.bold('Task:'))
    log(`  Prompt: ${chalk.dim(agentRunner.title ?? 'No title')}`)

    if (agentRunner.current_task) {
      log(`  Current Task: ${chalk.yellow(agentRunner.current_task)}`)
    }

    log(``)
    log(chalk.bold('Timeline:'))
    log(`  Created: ${formatDate(agentRunner.created_at)}`)
    log(`  Updated: ${formatDate(agentRunner.updated_at)}`)

    if (agentRunner.done_at) {
      log(`  Completed: ${formatDate(agentRunner.done_at)}`)
      log(`  Duration: ${formatDuration(agentRunner.created_at, agentRunner.done_at)}`)
    } else if (agentRunner.state === 'running') {
      log(`  Running for: ${formatDuration(agentRunner.created_at)}`)
    }

    // Show recent runs if available
    if (sessions && sessions.length > 0) {
      log(``)
      log(chalk.bold('Recent Runs:'))
      sessions.slice(0, 3).forEach((session, index) => {
        log(`  ${(index + 1).toString()}. ${formatStatus(session.state)} - ${session.title ?? 'No title'}`)
        if (session.result && session.state === 'done') {
          const resultPreview = session.result.length > 100 ? session.result.substring(0, 100) + '...' : session.result
          log(`     ${chalk.dim(resultPreview)}`)
        }
      })

      if (sessions.length > 3) {
        log(`     ${chalk.dim(`... and ${(sessions.length - 3).toString()} more runs`)}`)
      }
    }

    log(``)
    log(chalk.bold('Actions:'))

    if (agentRunner.state === 'running' || agentRunner.state === 'new') {
      log(`  Stop: ${chalk.cyan(`netlify agents:stop ${agentRunner.id}`)}`)
    }

    log(`  View in browser: ${chalk.blue(`https://app.netlify.com/sites/${site.id ?? ''}/agents/${agentRunner.id}`)}`)

    return agentRunner
  } catch (error_) {
    const error = error_ as Error

    stopSpinner({ spinner: showSpinner, error: true })

    return logAndThrowError(`Failed to show agent task: ${error.message}`)
  }
}
