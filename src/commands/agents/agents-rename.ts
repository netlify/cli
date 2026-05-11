import type { OptionValues } from 'commander'

import { chalk, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'

interface AgentRenameOptions extends OptionValues {
  json?: boolean
}

export const agentsRename = async (id: string, title: string, options: AgentRenameOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent task ID is required')
  const trimmed = title.trim()
  if (!trimmed) return logAndThrowError('A non-empty title is required')

  await command.authenticate()
  const api = createAgentsApi(command.netlify)

  const spinner = startSpinner({ text: 'Renaming agent task...' })
  try {
    const runner = await api.renameAgentRunner(id, trimmed)
    stopSpinner({ spinner })

    if (options.json) {
      logJson(runner)
      return runner
    }

    log(`${chalk.green('✓')} Agent task renamed.`)
    log(`  Task ID: ${chalk.cyan(runner.id)}`)
    log(`  Title: ${chalk.cyan(runner.title ?? trimmed)}`)
    return runner
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error & { status?: number }
    if (error.status === 404) return logAndThrowError(`Agent task not found: ${id}`)
    return logAndThrowError(`Failed to rename: ${error.message}`)
  }
}
