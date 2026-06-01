import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, exit, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'
import { TERMINAL_AGENT_STATES } from './constants.js'
import { formatStatus } from './utils.js'

interface AgentStopOptions extends OptionValues {
  json?: boolean
  yes?: boolean
}

export const agentsStop = async (id: string, options: AgentStopOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent run ID is required')
  await command.authenticate()
  const api = createAgentsApi(command.netlify)

  const fetchSpinner = startSpinner({ text: 'Checking agent run status...' })
  let runner
  try {
    runner = await api.getAgentRunner(id)
    stopSpinner({ spinner: fetchSpinner })
  } catch (error_) {
    stopSpinner({ spinner: fetchSpinner, error: true })
    const error = error_ as Error & { status?: number }
    if (error.status === 404) return logAndThrowError(`Agent run not found: ${id}`)
    return logAndThrowError(`Failed to fetch agent run: ${error.message}`)
  }

  if (runner.state && TERMINAL_AGENT_STATES.includes(runner.state as (typeof TERMINAL_AGENT_STATES)[number])) {
    if (options.json) {
      logJson(runner)
      return runner
    }
    log(chalk.yellow(`Agent run is already ${runner.state}.`))
    return runner
  }

  if (!options.yes && !options.json) {
    if (!process.stdin.isTTY) {
      return logAndThrowError('Refusing to stop without --yes when stdin is not a TTY')
    }
    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      { type: 'confirm', name: 'confirmed', message: `Stop agent run ${id}?`, default: false },
    ])
    if (!confirmed) return exit()
  }

  const stopSpin = startSpinner({ text: 'Stopping agent run...' })
  try {
    await api.deleteAgentRunner(id)
    stopSpinner({ spinner: stopSpin })
  } catch (error_) {
    stopSpinner({ spinner: stopSpin, error: true })
    const error = error_ as Error
    return logAndThrowError(`Failed to stop agent run: ${error.message}`)
  }

  const result = { success: true }
  if (options.json) {
    logJson(result)
    return result
  }

  log(`${chalk.green('✓')} Agent run stopped successfully!`)
  log()
  log(chalk.bold('Details:'))
  log(`  Run ID: ${chalk.cyan(id)}`)
  log(`  Previous Status: ${formatStatus(runner.state ?? 'unknown')}`)
  log(`  New Status: ${formatStatus('cancelled')}`)
  log()
  log(chalk.dim('The agent run has been stopped and will not continue processing.'))
  return result
}
