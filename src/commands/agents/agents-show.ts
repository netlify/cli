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

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

const formatDuration = (startTime: string, endTime?: string): string => {
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

interface AgentShowOptions extends OptionValues {
  json?: boolean
}

export const agentsShow = async (id: string, options: AgentShowOptions, command: BaseCommand) => {
  const { api, site, siteInfo, apiOpts } = command.netlify

  await command.authenticate()

  if (!id) {
    return logAndThrowError('Agent runner ID is required')
  }

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

    if (options.json) {
      logJson(agentRunner)
      return agentRunner
    }

    // Display detailed information
    log(chalk.bold('Agent Runner Details'))
    log(``)

    log(chalk.bold('Basic Information:'))
    log(`  ID: ${chalk.cyan(agentRunner.id)}`)
    log(`  Status: ${formatStatus(agentRunner.state ?? 'new')}`)
    log(`  Site: ${chalk.cyan(siteInfo.name)} (${site.id ?? ''})`)

    if (agentRunner.user) {
      log(`  Created by: ${agentRunner.user.full_name ?? 'Anonymous'}`)
    }

    log(``)
    log(chalk.bold('Configuration:'))
    log(`  Branch: ${chalk.cyan(agentRunner.branch ?? 'main')}`)

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

    // Show sessions if available
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
        const sessions = (await sessionsResponse.json()) as AgentRunnerSession[] | undefined
        if (sessions && sessions.length > 0) {
          log(``)
          log(chalk.bold('Recent Sessions:'))
          sessions.slice(0, 3).forEach((session, index: number) => {
            log(
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              `  ${(index + 1).toString()}. ${formatStatus(session.state ?? 'unknown')} - ${
                session.title ?? 'No title'
              }`,
            )
            if (session.result && session.state === 'done') {
              const resultPreview =
                session.result.length > 100 ? session.result.substring(0, 100) + '...' : session.result
              log(`     ${chalk.dim(resultPreview)}`)
            }
          })

          if (sessions.length > 3) {
            log(`     ${chalk.dim(`... and ${(sessions.length - 3).toString()} more sessions`)}`)
          }
        }
      }
    } catch {
      // Sessions fetch failed, but don't fail the whole command
    }

    log(``)
    log(chalk.bold('Actions:'))

    if (agentRunner.state === 'running' || agentRunner.state === 'new') {
      log(`  Stop: ${chalk.cyan(`netlify agents:stop ${agentRunner.id}`)}`)
    }

    log(`  View in browser: ${chalk.blue(`https://app.netlify.com/sites/${site.id ?? ''}/agents/${agentRunner.id}`)}`)

    return agentRunner
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
        return logAndThrowError('Agent runner not found. Check the ID and try again.')
      }
    }

    return logAndThrowError(`Failed to show agent runner: ${error.message}`)
  }
}
