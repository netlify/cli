import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'
import type { AgentRunner } from './types.js'

interface AgentCommitOptions extends OptionValues {
  branch?: string
  json?: boolean
}

const pickDefaultBranch = (runner: AgentRunner): { branch: string; reason: string } | null => {
  const prState = runner.pr_state
  const hasOpenPr = runner.pr_url && (prState === 'open' || prState === 'draft')
  if (hasOpenPr && runner.pr_branch) {
    return { branch: runner.pr_branch, reason: 'updating the existing pull request' }
  }
  if (runner.branch) {
    return { branch: runner.branch, reason: "committing to this agent task's branch" }
  }
  return null
}

export const agentsCommit = async (id: string, options: AgentCommitOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent task ID is required')
  await command.authenticate()
  const { siteInfo } = command.netlify
  if (!siteInfo.build_settings?.repo_url) {
    return logAndThrowError(
      'This project is not connected to a git repository. Commits are only available for git-backed projects.',
    )
  }
  const api = createAgentsApi(command.netlify)

  let targetBranch = options.branch?.trim()

  if (!targetBranch) {
    const lookupSpinner = startSpinner({ text: 'Looking up agent task...' })
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

    const suggestion = pickDefaultBranch(runner)
    if (!suggestion) {
      return logAndThrowError('Could not determine a target branch. Pass --branch <name>.')
    }

    if (options.json || !process.stdin.isTTY) {
      targetBranch = suggestion.branch
    } else {
      log(chalk.dim(`Default: ${suggestion.branch} (${suggestion.reason})`))
      const { branchInput } = await inquirer.prompt<{ branchInput: string }>([
        {
          type: 'input',
          name: 'branchInput',
          message: 'Which branch should the agent commit to?',
          default: suggestion.branch,
          validate: (input: string) => (input.trim().length > 0 ? true : 'Branch name is required'),
        },
      ])
      targetBranch = branchInput.trim()
    }
  }

  const spinner = startSpinner({ text: `Committing to ${targetBranch}...` })
  try {
    const runner = await api.agentRunnerCommitToBranch(id, targetBranch)
    stopSpinner({ spinner })

    if (options.json) {
      logJson(runner)
      return runner
    }

    if (runner.merge_commit_error) {
      log(`${chalk.red('✗')} Commit failed: ${runner.merge_commit_error}`)
      return runner
    }

    log(`${chalk.green('✓')} Committed to ${chalk.cyan(targetBranch)}`)
    log()
    if (runner.merge_commit_sha) log(`  SHA: ${chalk.cyan(runner.merge_commit_sha)}`)
    return runner
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error
    return logAndThrowError(`Failed to commit: ${error.message}`)
  }
}
