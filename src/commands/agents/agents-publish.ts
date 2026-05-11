import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, exit, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'
import type { AgentRunner } from './types.js'

interface AgentPublishOptions extends OptionValues {
  json?: boolean
  yes?: boolean
  force?: boolean
}

const isOutOfSync = (runner: AgentRunner): boolean =>
  Boolean(runner.needs_git_sync || runner.rebase_available || runner.merge_target_available)

const describeOutOfSync = (runner: AgentRunner): string => {
  if (runner.needs_git_sync) return 'the code origin has changed since this run started'
  if (runner.merge_target_available) return 'the target branch has new commits'
  return 'production has moved on since this run started'
}

export const agentsPublish = async (id: string, options: AgentPublishOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent task ID is required')
  await command.authenticate()
  const { siteInfo } = command.netlify
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

  const outOfSync = isOutOfSync(runner)
  if (outOfSync && !options.force) {
    if (options.json) {
      return logAndThrowError(
        `Refusing to publish: ${describeOutOfSync(runner)}. Run netlify agents:sync ${id} first, or pass --force.`,
      )
    }
    log(chalk.yellow(`! This agent task is out of date: ${describeOutOfSync(runner)}.`))
    log(`  Sync first: ${chalk.cyan(`netlify agents:sync ${id}`)}`)
    log(`  Or override: pass ${chalk.cyan('--force')} to publish the existing diff as-is`)
    if (!options.yes) {
      if (!process.stdin.isTTY) return logAndThrowError('Refusing to publish out-of-date run without --force')
      const { action } = await inquirer.prompt<{ action: 'sync' | 'publish' | 'cancel' }>([
        {
          type: 'list',
          name: 'action',
          message: 'How would you like to proceed?',
          choices: [
            { name: 'Sync with production first (recommended)', value: 'sync' },
            { name: 'Publish anyway', value: 'publish' },
            { name: 'Cancel', value: 'cancel' },
          ],
          default: 'sync',
        },
      ])
      if (action === 'cancel') return exit()
      if (action === 'sync') {
        const { agentsSync } = await import('./agents-sync.js')
        return agentsSync(id, { yes: true }, command)
      }
      // action === 'publish' falls through
    } else {
      return logAndThrowError('Refusing to publish out-of-date run without --force')
    }
  }

  if (!options.yes && !options.json && !outOfSync) {
    if (!process.stdin.isTTY) {
      return logAndThrowError('Refusing to publish without --yes when stdin is not a TTY')
    }
    log(chalk.redBright('Warning'), 'You are about to publish agent changes to production.')
    log(`         Site: ${chalk.bold(siteInfo.name)}`)
    log(`         Task: ${chalk.bold(id)}`)
    log()
    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Publish agent task ${id} to production?`,
        default: false,
      },
    ])
    if (!confirmed) return exit()
  }

  const spinner = startSpinner({ text: 'Publishing to production...' })
  try {
    const updated = await api.agentRunnerPublishToProduction(id)
    stopSpinner({ spinner })

    if (options.json) {
      logJson(updated)
      return updated
    }

    log(`${chalk.green('✓')} Published agent task to production!`)
    log()
    log(`  Task ID: ${chalk.cyan(updated.id)}`)
    if (updated.merge_commit_sha) log(`  Commit: ${chalk.cyan(updated.merge_commit_sha)}`)
    log(`  Browser: ${chalk.blue(`https://app.netlify.com/projects/${siteInfo.name}/agent-runs/${updated.id}`)}`)
    return updated
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error
    return logAndThrowError(`Failed to publish: ${error.message}`)
  }
}
