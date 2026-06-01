import type { OptionValues } from 'commander'

import { chalk, log, logAndThrowError } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import openBrowser from '../../utils/open-browser.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'
import { buildAgentDashboardUrl } from './utils.js'

const VALID_TARGETS = ['preview', 'dashboard', 'pr'] as const
type OpenTarget = (typeof VALID_TARGETS)[number]

const isOpenTarget = (input: string): input is OpenTarget => (VALID_TARGETS as readonly string[]).includes(input)

interface AgentOpenOptions extends OptionValues {
  json?: boolean
}

export const agentsOpen = async (
  id: string,
  targetArg: string | undefined,
  _options: AgentOpenOptions,
  command: BaseCommand,
) => {
  if (!id) return logAndThrowError('Agent run ID is required')

  const candidate = targetArg ?? 'preview'
  if (!isOpenTarget(candidate)) {
    return logAndThrowError(`Invalid target "${candidate}". Choose one of: ${VALID_TARGETS.join(', ')}`)
  }
  const target: OpenTarget = candidate

  await command.authenticate()
  const { siteInfo } = command.netlify
  const api = createAgentsApi(command.netlify)
  const dashboardUrl = buildAgentDashboardUrl(siteInfo.name, id)

  if (target === 'dashboard') {
    return openUrl(dashboardUrl)
  }

  const spinner = startSpinner({ text: 'Looking up agent run...' })
  let runner
  try {
    runner = await api.getAgentRunner(id)
    stopSpinner({ spinner })
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error & { status?: number }
    if (error.status === 404) return logAndThrowError(`Agent run not found: ${id}`)
    return logAndThrowError(`Failed to fetch agent run: ${error.message}`)
  }

  if (target === 'pr') {
    if (runner.pr_url) return openUrl(runner.pr_url)
    if (runner.pr_is_being_created) {
      log(chalk.yellow('A pull request is being created. Try again in a moment.'))
      return
    }
    if (runner.pr_error) {
      log(chalk.red(`Pull request creation failed: ${runner.pr_error}`))
      log(`Retry with: ${chalk.cyan(`netlify agents:pr ${id}`)}`)
      return
    }
    log(chalk.yellow('No pull request exists for this agent run.'))
    log(`Create one with: ${chalk.cyan(`netlify agents:pr ${id}`)}`)
    return
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
