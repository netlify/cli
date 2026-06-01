import type { OptionValues } from 'commander'

import { chalk, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'
import { sanitizeRunnerTitle, validateRunnerTitle } from './utils.js'

interface AgentRenameOptions extends OptionValues {
  json?: boolean
}

export const agentsRename = async (id: string, title: string, options: AgentRenameOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent run ID is required')
  const valid = validateRunnerTitle(title)
  if (valid !== true) return logAndThrowError(valid)
  const sanitized = sanitizeRunnerTitle(title)

  await command.authenticate()
  const api = createAgentsApi(command.netlify)

  const spinner = startSpinner({ text: 'Renaming agent run...' })
  try {
    const runner = await api.updateAgentRunner(id, { title: sanitized })
    stopSpinner({ spinner })

    if (options.json) {
      logJson(runner)
      return runner
    }

    log(`${chalk.green('✓')} Agent run renamed.`)
    log(`  Run ID: ${chalk.cyan(runner.id)}`)
    log(`  Title: ${chalk.cyan(runner.title ?? sanitized)}`)
    return runner
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error & { status?: number }
    if (error.status === 404) return logAndThrowError(`Agent run not found: ${id}`)
    return logAndThrowError(`Failed to rename: ${error.message}`)
  }
}
