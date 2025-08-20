import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, logAndThrowError, log, logJson, type APIError } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import type { AgentRunner } from './types.js'
import { validatePrompt, validateAgent, formatStatus, getAgentName } from './utils.js'
import { AVAILABLE_AGENTS } from './constants.js'

interface AgentCreateOptions extends OptionValues {
  prompt?: string
  agent?: string
  branch?: string
  model?: string
}

export const agentsCreate = async (promptArg: string, options: AgentCreateOptions, command: BaseCommand) => {
  const { api, site, siteInfo, apiOpts } = command.netlify

  await command.authenticate()

  const { prompt, agent: initialAgent, branch: initialBranch, model } = options

  let finalPrompt: string
  let agent = initialAgent
  let branch = initialBranch

  // Interactive prompt if not provided
  if (!prompt && !promptArg) {
    const { promptInput } = await inquirer.prompt<{
      promptInput: string
    }>([
      {
        type: 'input',
        name: 'promptInput',
        message: 'What would you like the agent to do?',
        validate: validatePrompt,
      },
    ])
    finalPrompt = promptInput
  } else {
    finalPrompt = (promptArg || prompt) ?? ''
  }

  const promptValidation = validatePrompt(finalPrompt)
  if (promptValidation !== true) {
    return logAndThrowError(promptValidation)
  }

  // Agent selection if not provided
  if (!agent) {
    const { agentInput } = await inquirer.prompt<{
      agentInput: string
    }>([
      {
        type: 'list',
        name: 'agentInput',
        message: 'Which agent would you like to use?',
        choices: AVAILABLE_AGENTS,
        default: 'claude',
      },
    ])
    agent = agentInput
  } else {
    // Validate provided agent
    const agentValidation = validateAgent(agent)
    if (agentValidation !== true) {
      return logAndThrowError(agentValidation)
    }
  }

  // Use site's default branch if not specified
  if (!branch) {
    // Try to get default branch from site info, fallback to 'main'
    branch = siteInfo.build_settings?.repo_branch ?? 'main'
  }

  const createSpinner = startSpinner({ text: 'Creating agent task...' })

  try {
    // Create the agent runner using the same API format as the React UI
    const createParams = new URLSearchParams()
    createParams.set('site_id', site.id ?? '')

    const response = await fetch(
      `${apiOpts.scheme ?? 'https'}://${apiOpts.host ?? api.host}/api/v1/agent_runners?${createParams.toString()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${api.accessToken ?? ''}`,
          'Content-Type': 'application/json',
          'User-Agent': apiOpts.userAgent,
        },
        body: JSON.stringify({
          branch,
          prompt: finalPrompt,
          agent,
          model,
        }),
      },
    )

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string }
      throw new Error(errorData.error ?? `HTTP ${response.status.toString()}: ${response.statusText}`)
    }

    const agentRunner = (await response.json()) as AgentRunner
    stopSpinner({ spinner: createSpinner })

    if (options.json) {
      logJson(agentRunner)
      return agentRunner
    }

    log(`${chalk.green('✓')} Agent task created successfully!`)
    log(``)
    log(chalk.bold('Details:'))
    log(`  Task ID: ${chalk.cyan(agentRunner.id)}`)
    log(`  Prompt: ${chalk.dim(finalPrompt)}`)
    log(`  Agent: ${chalk.cyan(getAgentName(agent))}${model ? ` (${model})` : ''}`)
    log(`  Branch: ${chalk.cyan(branch)}`)
    log(`  Status: ${formatStatus(agentRunner.state ?? 'new')}`)
    log(``)
    log(chalk.bold('Monitor progress:'))
    log(`  CLI: ${chalk.cyan(`netlify agents:show ${agentRunner.id}`)}`)
    log(
      `  View in browser: ${chalk.blue(
        `https://app.netlify.com/sites/${site.id ?? siteInfo.id}/agents/${agentRunner.id}`,
      )}`,
    )
    log(``)
    log(
      chalk.dim(
        'Note: The agent task will run remotely on Netlify infrastructure and may take a few minutes to complete.',
      ),
    )

    return agentRunner
  } catch (error_) {
    stopSpinner({ spinner: createSpinner, error: true })
    const error = error_ as APIError | Error

    // Handle specific error cases
    if ('status' in error) {
      if (error.status === 401) {
        return logAndThrowError('Authentication failed. Please run `netlify login` to authenticate.')
      }
      if (error.status === 403) {
        return logAndThrowError(
          'Permission denied. Make sure you have access to this site and agent tasks are enabled.',
        )
      }
      if (error.status === 404) {
        return logAndThrowError('Site not found. Make sure the site exists and you have access to it.')
      }
      if (error.status === 422) {
        return logAndThrowError(`Invalid configuration: ${error.message}`)
      }
    }

    return logAndThrowError(`Failed to create agent task: ${error.message}`)
  }
}
