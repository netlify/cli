import type { OptionValues } from 'commander'

import { chalk, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'

interface AgentPrOptions extends OptionValues {
  json?: boolean
}

export const agentsPullRequest = async (id: string, options: AgentPrOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent task ID is required')
  await command.authenticate()
  const { siteInfo } = command.netlify
  if (!siteInfo.build_settings?.repo_url) {
    return logAndThrowError('This project is not connected to a git repository. Pull requests are only available for git-backed projects.')
  }
  const api = createAgentsApi(command.netlify)

  const spinner = startSpinner({ text: 'Creating pull request...' })
  try {
    const runner = await api.agentRunnerPullRequest(id)
    stopSpinner({ spinner })

    if (options.json) {
      logJson(runner)
      return runner
    }

    if (runner.pr_error) {
      log(`${chalk.red('✗')} Pull request failed: ${runner.pr_error}`)
      return runner
    }

    log(`${chalk.green('✓')} Pull request created!`)
    log()
    if (runner.pr_url) log(`  URL: ${chalk.blue(runner.pr_url)}`)
    if (runner.pr_branch) log(`  Branch: ${chalk.cyan(runner.pr_branch)}`)
    if (runner.pr_state) log(`  State: ${chalk.cyan(runner.pr_state)}`)
    return runner
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error & { status?: number }
    if (error.status === 404) return logAndThrowError(`Agent task not found: ${id}`)
    return logAndThrowError(`Failed to create pull request: ${error.message}`)
  }
}
