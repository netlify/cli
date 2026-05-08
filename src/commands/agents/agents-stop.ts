import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, exit, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'
import { TERMINAL_AGENT_STATES, TERMINAL_SESSION_STATES } from './constants.js'
import { formatStatus } from './utils.js'

interface AgentStopOptions extends OptionValues {
  json?: boolean
  session?: string
  yes?: boolean
}

export const agentsStop = async (id: string, options: AgentStopOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent task ID is required')
  await command.authenticate()
  const api = createAgentsApi(command.netlify)

  if (options.session) {
    return stopSession(api, id, options.session, options)
  }

  return stopRunner(api, id, options)
}

const stopRunner = async (api: ReturnType<typeof createAgentsApi>, id: string, options: AgentStopOptions) => {
  const fetchSpinner = startSpinner({ text: 'Checking agent task status...' })
  let runner
  try {
    runner = await api.getAgentRunner(id)
    stopSpinner({ spinner: fetchSpinner })
  } catch (error_) {
    stopSpinner({ spinner: fetchSpinner, error: true })
    const error = error_ as Error
    return logAndThrowError(`Failed to fetch agent task: ${error.message}`)
  }

  if (runner.state && TERMINAL_AGENT_STATES.includes(runner.state as (typeof TERMINAL_AGENT_STATES)[number])) {
    log(chalk.yellow(`Agent task is already ${runner.state}.`))
    return runner
  }

  if (!options.yes && !options.json) {
    const confirmed = await confirmStop(`Stop agent task ${id}?`)
    if (!confirmed) return exit()
  }

  const stopSpin = startSpinner({ text: 'Stopping agent task...' })
  try {
    await api.stopAgentRunner(id)
    stopSpinner({ spinner: stopSpin })
  } catch (error_) {
    stopSpinner({ spinner: stopSpin, error: true })
    const error = error_ as Error
    return logAndThrowError(`Failed to stop agent task: ${error.message}`)
  }

  const result = { success: true }
  if (options.json) {
    logJson(result)
    return result
  }

  log(`${chalk.green('✓')} Agent task stopped successfully!`)
  log()
  log(chalk.bold('Details:'))
  log(`  Task ID: ${chalk.cyan(id)}`)
  log(`  Previous Status: ${formatStatus(runner.state ?? 'unknown')}`)
  log(`  New Status: ${formatStatus('cancelled')}`)
  log()
  log(chalk.dim('The agent task has been stopped and will not continue processing.'))
  return result
}

const stopSession = async (
  api: ReturnType<typeof createAgentsApi>,
  id: string,
  sessionId: string,
  options: AgentStopOptions,
) => {
  const fetchSpinner = startSpinner({ text: 'Checking session status...' })
  let session
  try {
    session = await api.getAgentRunnerSession(id, sessionId)
    stopSpinner({ spinner: fetchSpinner })
  } catch (error_) {
    stopSpinner({ spinner: fetchSpinner, error: true })
    const error = error_ as Error
    return logAndThrowError(`Failed to fetch session: ${error.message}`)
  }

  if (TERMINAL_SESSION_STATES.includes(session.state as (typeof TERMINAL_SESSION_STATES)[number])) {
    log(chalk.yellow(`Session is already ${session.state}.`))
    return session
  }

  if (!options.yes && !options.json) {
    const confirmed = await confirmStop(`Stop session ${sessionId}?`)
    if (!confirmed) return exit()
  }

  const stopSpin = startSpinner({ text: 'Stopping session...' })
  try {
    await api.stopAgentRunnerSession(id, sessionId)
    stopSpinner({ spinner: stopSpin })
  } catch (error_) {
    stopSpinner({ spinner: stopSpin, error: true })
    const error = error_ as Error
    return logAndThrowError(`Failed to stop session: ${error.message}`)
  }

  const result = { success: true }
  if (options.json) {
    logJson(result)
    return result
  }

  log(`${chalk.green('✓')} Session stopped successfully!`)
  log()
  log(`  Session ID: ${chalk.cyan(sessionId)}`)
  log(`  Previous Status: ${formatStatus(session.state)}`)
  return result
}

const confirmStop = async (message: string): Promise<boolean> => {
  if (!process.stdin.isTTY) {
    return logAndThrowError('Refusing to stop without --yes when stdin is not a TTY')
  }
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    { type: 'confirm', name: 'confirmed', message, default: false },
  ])
  return confirmed
}
