import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, exit, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'

interface AgentPublishOptions extends OptionValues {
  json?: boolean
  yes?: boolean
}

export const agentsPublish = async (id: string, options: AgentPublishOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent task ID is required')
  await command.authenticate()
  const { siteInfo } = command.netlify
  const api = createAgentsApi(command.netlify)

  if (!options.yes && !options.json) {
    if (!process.stdout.isTTY) {
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
    const runner = await api.agentRunnerPublishToProduction(id)
    stopSpinner({ spinner })

    if (options.json) {
      logJson(runner)
      return runner
    }

    log(`${chalk.green('✓')} Published agent task to production!`)
    log()
    log(`  Task ID: ${chalk.cyan(runner.id)}`)
    if (runner.merge_commit_sha) log(`  Commit: ${chalk.cyan(runner.merge_commit_sha)}`)
    log(`  Browser: ${chalk.blue(`https://app.netlify.com/projects/${siteInfo.name}/agent-runs/${runner.id}`)}`)
    return runner
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error
    return logAndThrowError(`Failed to publish: ${error.message}`)
  }
}
