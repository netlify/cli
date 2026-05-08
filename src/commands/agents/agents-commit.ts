import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'

interface AgentCommitOptions extends OptionValues {
  branch?: string
  json?: boolean
}

export const agentsCommit = async (id: string, options: AgentCommitOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent task ID is required')
  await command.authenticate()
  const api = createAgentsApi(command.netlify)

  let targetBranch = options.branch?.trim()
  if (!targetBranch) {
    if (!process.stdin.isTTY) {
      return logAndThrowError('--branch is required when stdin is not a TTY')
    }
    const { branchInput } = await inquirer.prompt<{ branchInput: string }>([
      {
        type: 'input',
        name: 'branchInput',
        message: 'Which branch should the agent commit to?',
        validate: (input: string) => (input.trim().length > 0 ? true : 'Branch name is required'),
      },
    ])
    targetBranch = branchInput.trim()
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
