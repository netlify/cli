import type { OptionValues } from 'commander'

import { chalk, log, logAndThrowError } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import openBrowser from '../../utils/open-browser.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'

const VALID_TARGETS = ['preview', 'dashboard', 'pr'] as const
type OpenTarget = (typeof VALID_TARGETS)[number]

interface AgentOpenOptions extends OptionValues {
  json?: boolean
}

export const agentsOpen = async (
  id: string,
  targetArg: string | undefined,
  _options: AgentOpenOptions,
  command: BaseCommand,
) => {
  if (!id) return logAndThrowError('Agent task ID is required')

  const target: OpenTarget = (targetArg ?? 'preview') as OpenTarget
  if (!VALID_TARGETS.includes(target)) {
    return logAndThrowError(`Invalid target "${target}". Choose one of: ${VALID_TARGETS.join(', ')}`)
  }

  await command.authenticate()
  const { siteInfo } = command.netlify
  const api = createAgentsApi(command.netlify)
  const dashboardUrl = `https://app.netlify.com/projects/${siteInfo.name}/agent-runs/${id}`

  if (target === 'dashboard') {
    return openUrl(dashboardUrl)
  }

  const spinner = startSpinner({ text: 'Looking up agent task...' })
  let runner
  try {
    runner = await api.getAgentRunner(id)
    stopSpinner({ spinner })
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error
    return logAndThrowError(`Failed to fetch agent task: ${error.message}`)
  }

  if (target === 'pr') {
    if (!runner.pr_url) {
      log(chalk.yellow('No pull request exists for this agent task.'))
      log(`Create one with: ${chalk.cyan(`netlify agents:pr ${id}`)}`)
      return
    }
    return openUrl(runner.pr_url)
  }

  const previewUrl = runner.latest_session_deploy_url
  if (!previewUrl) {
    log(chalk.yellow('No deploy preview available yet — opening dashboard instead.'))
    return openUrl(dashboardUrl)
  }
  return openUrl(previewUrl)
}

const openUrl = async (url: string): Promise<void> => {
  log(`Opening ${chalk.blue(url)}`)
  await openBrowser({ url })
}
