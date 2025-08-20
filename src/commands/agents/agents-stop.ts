import type { OptionValues } from 'commander'

import { chalk, logAndThrowError, log, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import type { AgentRunner } from './types.js'
import { formatStatus } from './utils.js'

interface AgentStopOptions extends OptionValues {
  json?: boolean
}

export const agentsStop = async (id: string, options: AgentStopOptions, command: BaseCommand) => {
  const { api, apiOpts } = command.netlify

  await command.authenticate()

  if (!id) {
    return logAndThrowError('Agent task ID is required')
  }

  const statusSpinner = startSpinner({ text: 'Checking agent task status...' })

  try {
    // First check if the agent runner exists and is stoppable
    const statusResponse = await fetch(
      `${apiOpts.scheme ?? 'https'}://${apiOpts.host ?? api.host}/api/v1/agent_runners/${id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${api.accessToken ?? ''}`,
          'User-Agent': apiOpts.userAgent,
        },
      },
    )

    if (!statusResponse.ok) {
      const errorData = (await statusResponse.json().catch(() => ({}))) as { error?: string }
      throw new Error(errorData.error ?? `HTTP ${statusResponse.status.toString()}: ${statusResponse.statusText}`)
    }

    const agentRunner = (await statusResponse.json()) as AgentRunner
    stopSpinner({ spinner: statusSpinner })

    // Check if agent task can be stopped
    if (agentRunner.state === 'done') {
      log(chalk.yellow('Agent task is already completed.'))
      return agentRunner
    }

    if (agentRunner.state === 'cancelled') {
      log(chalk.yellow('Agent task is already cancelled.'))
      return agentRunner
    }

    if (agentRunner.state === 'error') {
      log(chalk.yellow('Agent task has already errored.'))
      return agentRunner
    }

    // Stop the agent task
    const stopSpinnerInstance = startSpinner({ text: 'Stopping agent task...' })

    const response = await fetch(
      `${apiOpts.scheme ?? 'https'}://${apiOpts.host ?? api.host}/api/v1/agent_runners/${id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${api.accessToken ?? ''}`,
          'User-Agent': apiOpts.userAgent,
        },
      },
    )

    stopSpinner({ spinner: stopSpinnerInstance })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string }
      throw new Error(errorData.error ?? `HTTP ${response.status.toString()}: ${response.statusText}`)
    }

    // Success case, 202 with empty body
    const result = { success: true }

    if (options.json) {
      logJson(result)
      return result
    }

    log(`${chalk.green('✓')} Agent task stopped successfully!`)
    log(``)
    log(chalk.bold('Details:'))
    log(`  Task ID: ${chalk.cyan(id)}`)
    log(`  Previous Status: ${formatStatus(agentRunner.state ?? 'unknown')}`)
    log(`  New Status: ${formatStatus('cancelled')}`)
    log(``)
    log(chalk.dim('The agent task has been stopped and will not continue processing.'))

    return result
  } catch (error_) {
    const error = error_ as Error

    stopSpinner({ spinner: statusSpinner, error: true })

    return logAndThrowError(`Failed to stop agent task: ${error.message}`)
  }
}
