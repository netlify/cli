import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, exit, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi, type AgentsApi } from './api.js'
import type { AgentRunner } from './types.js'

interface AgentSyncOptions extends OptionValues {
  json?: boolean
  yes?: boolean
}

type SyncStrategy = 'sync_git_origin' | 'merge_target' | 'rebase'

const pickStrategy = (runner: AgentRunner): SyncStrategy | null => {
  if (runner.needs_git_sync) return 'sync_git_origin'
  if (runner.merge_target_available) return 'merge_target'
  if (runner.rebase_available) return 'rebase'
  return null
}

const describeStrategy = (strategy: SyncStrategy): string => {
  switch (strategy) {
    case 'sync_git_origin':
      return 'sync with the remote git origin (code origin changed)'
    case 'merge_target':
      return 'merge the latest target branch into this agent run'
    case 'rebase':
      return 'reapply changes on top of the latest production deploy'
  }
}

const runStrategy = (api: AgentsApi, strategy: SyncStrategy, id: string): Promise<AgentRunner> => {
  switch (strategy) {
    case 'sync_git_origin':
      return api.syncGitOriginAgentRunner(id)
    case 'merge_target':
      return api.mergeTargetAgentRunner(id)
    case 'rebase':
      return api.rebaseAgentRunner(id)
  }
}

export const agentsSync = async (id: string, options: AgentSyncOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent task ID is required')
  await command.authenticate()
  const api = createAgentsApi(command.netlify)

  const lookupSpinner = startSpinner({ text: 'Checking agent task state...' })
  let runner: AgentRunner
  try {
    runner = await api.getAgentRunner(id)
    stopSpinner({ spinner: lookupSpinner })
  } catch (error_) {
    stopSpinner({ spinner: lookupSpinner, error: true })
    const error = error_ as Error & { status?: number }
    if (error.status === 404) return logAndThrowError(`Agent task not found: ${id}`)
    return logAndThrowError(`Failed to fetch agent task: ${error.message}`)
  }

  const strategy = pickStrategy(runner)
  if (!strategy) {
    log(chalk.yellow('Nothing to sync — this agent task is already up to date.'))
    return runner
  }

  if (!options.yes && !options.json) {
    if (!process.stdin.isTTY) {
      return logAndThrowError('Refusing to sync without --yes when stdin is not a TTY')
    }
    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Sync agent task ${id}? This will ${describeStrategy(strategy)}.`,
        default: false,
      },
    ])
    if (!confirmed) return exit()
  }

  const spinner = startSpinner({ text: 'Syncing agent task...' })
  try {
    const updated = await runStrategy(api, strategy, id)
    stopSpinner({ spinner })

    if (options.json) {
      logJson(updated)
      return updated
    }

    log(`${chalk.green('✓')} Sync started: ${describeStrategy(strategy)}.`)
    log(`  Task ID: ${chalk.cyan(updated.id)}`)
    log()
    log(`Watch progress: ${chalk.cyan(`netlify agents:show ${updated.id} --watch`)}`)
    return updated
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error
    return logAndThrowError(`Failed to sync: ${error.message}`)
  }
}
