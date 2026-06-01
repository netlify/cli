import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'
import { uploadAttachments, type UploadedAttachment } from './attachments.js'
import { AVAILABLE_AGENTS, TERMINAL_SESSION_STATES, type AvailableAgent } from './constants.js'
import type { CreateAgentRunnerSessionPayload } from './types.js'
import {
  checkModelAvailability,
  formatBytes,
  formatStatus,
  getAgentName,
  sanitizePromptText,
  validateAgent,
  validatePrompt,
} from './utils.js'

interface AgentFollowUpOptions extends OptionValues {
  prompt?: string
  agent?: string
  model?: string
  attach?: string[]
  json?: boolean
}

export const agentsFollowUp = async (
  id: string,
  promptArg: string,
  options: AgentFollowUpOptions,
  command: BaseCommand,
) => {
  if (!id) return logAndThrowError('Agent run ID is required')
  await command.authenticate()
  const { siteInfo } = command.netlify
  const api = createAgentsApi(command.netlify)

  if (options.attach && options.attach.length > 0 && !siteInfo.account_id) {
    return logAndThrowError('Cannot attach files: no account ID is available for this site')
  }

  let finalPrompt = promptArg || options.prompt
  if (!finalPrompt) {
    if (options.json) {
      return logAndThrowError('A prompt is required. Pass it as the positional argument or via --prompt.')
    }
    const { promptInput } = await inquirer.prompt<{ promptInput: string }>([
      {
        type: 'input',
        name: 'promptInput',
        message: 'What would you like the agent to do next?',
        validate: validatePrompt,
      },
    ])
    finalPrompt = promptInput
  }
  const promptValid = validatePrompt(finalPrompt)
  if (promptValid !== true) return logAndThrowError(promptValid)

  let lastSessionAgent: AvailableAgent | undefined
  let lastSessionModel: string | undefined
  let recent: import('./types.js').AgentRunnerSession | undefined
  try {
    const recentSessions = await api.listAgentRunnerSessions(id, { page: 1, per_page: 1, order_by: 'desc' })
    if (recentSessions.length > 0) recent = recentSessions[0]
  } catch {
    // If lookup fails, fall through and let the create call surface the real error.
  }

  if (recent && !TERMINAL_SESSION_STATES.includes(recent.state as (typeof TERMINAL_SESSION_STATES)[number])) {
    log(chalk.yellow('A session is already running on this run. Wait for it to finish or stop it first:'))
    log(`  ${chalk.cyan(`netlify agents:stop ${id}`)}`)
    return logAndThrowError('Cannot create a follow-up while a session is still active')
  }

  if (recent) {
    const previousAgent = recent.agent_config?.agent
    if (previousAgent && AVAILABLE_AGENTS.some((entry) => entry.value === previousAgent)) {
      lastSessionAgent = previousAgent
    }
    if (recent.agent_config?.model) lastSessionModel = recent.agent_config.model
  }

  let agent: AvailableAgent | undefined = lastSessionAgent
  if (options.agent) {
    const valid = validateAgent(options.agent)
    if (valid !== true) return logAndThrowError(valid)
    agent = options.agent as AvailableAgent
  }
  const model = options.model ?? lastSessionModel
  if (model && agent) {
    const valid = await checkModelAvailability(api, agent, model)
    if (valid !== true) log(chalk.yellow(`⚠ ${valid}`))
  }

  let attachments: UploadedAttachment[] = []
  if (options.attach && options.attach.length > 0 && siteInfo.account_id) {
    const uploadSpinner = startSpinner({ text: `Uploading ${options.attach.length.toString()} attachment(s)...` })
    try {
      attachments = await uploadAttachments(api, siteInfo.account_id, options.attach)
      stopSpinner({ spinner: uploadSpinner })
      for (const file of attachments) {
        log(`  ${chalk.green('✓')} ${file.filename} ${chalk.dim(`(${formatBytes(file.size)})`)}`)
      }
    } catch (error_) {
      stopSpinner({ spinner: uploadSpinner, error: true })
      const error = error_ as Error
      return logAndThrowError(error.message)
    }
  }

  const payload: CreateAgentRunnerSessionPayload = {
    prompt: sanitizePromptText(finalPrompt),
    agent,
    model,
    file_keys: attachments.length > 0 ? attachments.map((entry) => entry.fileKey) : undefined,
  }

  const spinner = startSpinner({ text: 'Sending follow-up prompt...' })
  try {
    const session = await api.createAgentRunnerSession(id, payload)
    stopSpinner({ spinner })

    if (options.json) {
      logJson(session)
      return session
    }

    log(`${chalk.green('✓')} Follow-up session created!`)
    log()
    log(chalk.bold('Details:'))
    log(`  Run ID: ${chalk.cyan(id)}`)
    log(`  Session ID: ${chalk.cyan(session.id)}`)
    log(`  Prompt: ${chalk.dim(finalPrompt)}`)
    if (agent) log(`  Agent: ${chalk.cyan(getAgentName(agent))}${model ? ` (${model})` : ''}`)
    log(`  Status: ${formatStatus(session.state)}`)
    log()
    log(chalk.bold('Monitor progress:'))
    log(`  Watch: ${chalk.cyan(`netlify agents:show ${id} --watch`)}`)
    log(`  Show:  ${chalk.cyan(`netlify agents:show ${id}`)}`)
    return session
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error & { status?: number }
    if (error.status === 404) return logAndThrowError(`Agent run not found: ${id}`)
    if (error.message.toLowerCase().includes('active session')) {
      log()
      log(chalk.yellow('A session is already running on this run. Wait for it to finish or stop it first:'))
      log(`  ${chalk.cyan(`netlify agents:stop ${id}`)}`)
    }
    return logAndThrowError(`Failed to send follow-up: ${error.message}`)
  }
}
