import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, exit, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'

interface AgentArchiveOptions extends OptionValues {
  json?: boolean
  yes?: boolean
}

export const agentsArchive = async (id: string, options: AgentArchiveOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent task ID is required')
  await command.authenticate()
  const api = createAgentsApi(command.netlify)

  if (!options.yes && !options.json) {
    if (!process.stdin.isTTY) {
      return logAndThrowError('Refusing to archive without --yes when stdin is not a TTY')
    }
    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Archive agent task ${id}?`,
        default: false,
      },
    ])
    if (!confirmed) return exit()
  }

  const spinner = startSpinner({ text: 'Archiving agent task...' })
  try {
    await api.archiveAgentRunner(id)
    stopSpinner({ spinner })

    const result = { success: true, id }
    if (options.json) {
      logJson(result)
      return result
    }

    log(`${chalk.green('✓')} Agent task archived.`)
    log(`  Task ID: ${chalk.cyan(id)}`)
    return result
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error
    return logAndThrowError(`Failed to archive: ${error.message}`)
  }
}
