import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, logAndThrowError, log, logJson } from '../../utils/command-helpers.js'
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

  const isGitBased = Boolean(siteInfo.build_settings?.repo_branch)

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

  const promptIsValid = validatePrompt(finalPrompt)
  if (promptIsValid !== true) {
    return logAndThrowError(promptIsValid)
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
    const agentIsValid = validateAgent(agent)
    if (agentIsValid !== true) {
      return logAndThrowError(agentIsValid)
    }
  }

  if (isGitBased) {
    if (!branch) {
      const defaultBranch = siteInfo.build_settings?.repo_branch

      const { branchInput } = await inquirer.prompt<{
        branchInput: string
      }>([
        {
          type: 'input',
          name: 'branchInput',
          message: 'Which branch would you like to work on?',
          default: defaultBranch,
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return 'Branch name is required'
            }
            return true
          },
        },
      ])

      branch = branchInput.trim()
    }
  } else {
    branch = undefined
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
          ...(branch ? { branch } : {}),
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
    if (isGitBased && branch) {
      log(`  Branch: ${chalk.cyan(branch)}`)
    } else {
      log(`  Base: ${chalk.cyan('Latest production deployment')}`)
    }
    log(`  Status: ${formatStatus(agentRunner.state ?? 'new')}`)
    log(``)
    log(chalk.bold('Monitor progress:'))
    log(`  CLI: ${chalk.cyan(`netlify agents:show ${agentRunner.id}`)}`)
    log(
      `  View in browser: ${chalk.blue(
        `https://app.netlify.com/projects/${siteInfo.name}/agent-runs/${agentRunner.id}`,
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
    const error = error_ as Error

    stopSpinner({ spinner: createSpinner, error: true })

    return logAndThrowError(`Failed to create agent task: ${error.message}`)
  }
}
