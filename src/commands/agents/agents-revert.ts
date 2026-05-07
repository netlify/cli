import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, exit, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'

interface AgentRevertOptions extends OptionValues {
  json?: boolean
  yes?: boolean
  session?: string
}

export const agentsRevert = async (id: string, options: AgentRevertOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent task ID is required')
  if (!options.session) return logAndThrowError('--session <id> is required: revert targets a specific session')
  await command.authenticate()
  const api = createAgentsApi(command.netlify)

  if (!options.yes && !options.json) {
    if (!process.stdout.isTTY) {
      return logAndThrowError('Refusing to revert without --yes when stdin is not a TTY')
    }
    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Revert agent task ${id} to session ${options.session}? Sessions after that will be discarded.`,
        default: false,
      },
    ])
    if (!confirmed) return exit()
  }

  const spinner = startSpinner({ text: 'Reverting agent task...' })
  try {
    const runner = await api.agentRunnerRevert(id, options.session)
    stopSpinner({ spinner })

    if (options.json) {
      logJson(runner)
      return runner
    }

    log(`${chalk.green('✓')} Agent task reverted!`)
    log(`  Task ID: ${chalk.cyan(runner.id)}`)
    log(`  Reverted to session: ${chalk.cyan(options.session)}`)
    return runner
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error
    return logAndThrowError(`Failed to revert: ${error.message}`)
  }
}
