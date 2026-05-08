import { execSync, spawnSync } from 'child_process'

import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'
import { AVAILABLE_AGENTS, type AvailableAgent, type UserSelectableMode } from './constants.js'
import { uploadAttachments, type UploadedAttachment } from './attachments.js'
import type { CreateAgentRunnerPayload } from './types.js'
import {
  checkModelAvailability,
  formatBytes,
  formatStatus,
  getAgentName,
  validateAgent,
  validateMode,
  validatePrompt,
} from './utils.js'

interface AgentCreateOptions extends OptionValues {
  prompt?: string
  agent?: string
  branch?: string
  model?: string
  mode?: string
  fromDeploy?: string
  parent?: string
  devServerImage?: string
  attach?: string[]
  json?: boolean
}

interface LocalGitInfo {
  branch?: string
  isDirty?: boolean
  hasUnpushedCommits?: boolean
  isInsideRepo: boolean
}

const detectLocalGit = (): LocalGitInfo => {
  const run = (command: string): string =>
    execSync(command, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim()
  try {
    run('git rev-parse --is-inside-work-tree')
  } catch {
    return { isInsideRepo: false }
  }
  let branch: string | undefined
  try {
    const head = run('git rev-parse --abbrev-ref HEAD')
    if (head && head !== 'HEAD') branch = head
  } catch {
    // Ignore
  }
  let isDirty: boolean | undefined
  try {
    isDirty = run('git status --porcelain').length > 0
  } catch {
    // Ignore
  }
  let hasUnpushedCommits: boolean | undefined
  if (branch) {
    try {
      const upstream = run('git rev-parse --abbrev-ref --symbolic-full-name @{u}')
      if (upstream) {
        const result = spawnSync('git', ['rev-list', '--count', `${upstream}..HEAD`], {
          stdio: ['ignore', 'pipe', 'ignore'],
          encoding: 'utf8',
        })
        hasUnpushedCommits = Number.parseInt(result.stdout.trim(), 10) > 0
      }
    } catch {
      // No upstream configured: can't tell.
    }
  }
  return { isInsideRepo: true, branch, isDirty, hasUnpushedCommits }
}

export const agentsCreate = async (promptArg: string, options: AgentCreateOptions, command: BaseCommand) => {
  const { site, siteInfo } = command.netlify

  await command.authenticate()

  if (options.fromDeploy && options.branch) {
    return logAndThrowError('--from-deploy and --branch are mutually exclusive')
  }

  if (options.attach && options.attach.length > 0 && !siteInfo.account_id) {
    return logAndThrowError('Cannot attach files: no account ID is available for this site')
  }

  if (options.mode) {
    const valid = validateMode(options.mode)
    if (valid !== true) return logAndThrowError(valid)
  }

  const finalPrompt = await resolvePrompt(promptArg, options.prompt)
  const agent = await resolveAgent(options.agent)

  const isGitBased = Boolean(siteInfo.build_settings?.repo_branch)
  let branch: string | undefined

  if (isGitBased && !options.fromDeploy) {
    branch = await resolveBranch(options.branch, siteInfo.build_settings?.repo_branch)
  }

  const api = createAgentsApi(command.netlify)

  if (options.model) {
    const valid = await checkModelAvailability(api, agent, options.model)
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

  const payload: CreateAgentRunnerPayload = {
    prompt: finalPrompt,
    agent,
    model: options.model,
    branch,
    deploy_id: options.fromDeploy,
    parent_agent_runner_id: options.parent,
    mode: options.mode as UserSelectableMode | undefined,
    dev_server_image: options.devServerImage,
    file_keys: attachments.length > 0 ? attachments.map((entry) => entry.fileKey) : undefined,
  }

  const createSpinner = startSpinner({ text: 'Creating agent task...' })
  try {
    const agentRunner = await api.createAgentRunner(site.id ?? '', payload)
    stopSpinner({ spinner: createSpinner })

    if (options.json) {
      logJson(agentRunner)
      return agentRunner
    }

    log(`${chalk.green('✓')} Agent task created successfully!`)
    log()
    log(chalk.bold('Details:'))
    log(`  Task ID: ${chalk.cyan(agentRunner.id)}`)
    log(`  Prompt: ${chalk.dim(finalPrompt)}`)
    log(`  Agent: ${chalk.cyan(getAgentName(agent))}${options.model ? ` (${options.model})` : ''}`)
    if (options.mode && options.mode !== 'normal') log(`  Mode: ${chalk.cyan(options.mode)}`)
    if (options.fromDeploy) {
      log(`  Base Deploy: ${chalk.cyan(options.fromDeploy)}`)
    } else if (isGitBased && branch) {
      log(`  Branch: ${chalk.cyan(branch)}`)
    } else {
      log(`  Base: ${chalk.cyan('Latest production deployment')}`)
    }
    if (options.parent) log(`  Parent Task: ${chalk.cyan(options.parent)}`)
    if (attachments.length > 0) log(`  Attachments: ${attachments.length.toString()} file(s)`)
    log(`  Status: ${formatStatus(agentRunner.state ?? 'new')}`)
    log()
    log(chalk.bold('Monitor progress:'))
    log(`  Watch: ${chalk.cyan(`netlify agents:show ${agentRunner.id} --watch`)}`)
    log(`  Show:  ${chalk.cyan(`netlify agents:show ${agentRunner.id}`)}`)
    log(`  Browser: ${chalk.blue(`https://app.netlify.com/projects/${siteInfo.name}/agent-runs/${agentRunner.id}`)}`)
    log()
    log(chalk.dim('The agent task runs remotely on Netlify infrastructure and may take a few minutes.'))

    return agentRunner
  } catch (error_) {
    stopSpinner({ spinner: createSpinner, error: true })
    const error = error_ as Error
    return logAndThrowError(`Failed to create agent task: ${error.message}`)
  }
}

const resolvePrompt = async (promptArg: string, promptFlag?: string): Promise<string> => {
  if (!promptArg && !promptFlag) {
    const { promptInput } = await inquirer.prompt<{ promptInput: string }>([
      {
        type: 'input',
        name: 'promptInput',
        message: 'What would you like the agent to do?',
        validate: validatePrompt,
      },
    ])
    return promptInput
  }
  const final = (promptArg || promptFlag) ?? ''
  const valid = validatePrompt(final)
  if (valid !== true) {
    return logAndThrowError(valid)
  }
  return final
}

const resolveAgent = async (agentFlag?: string): Promise<AvailableAgent> => {
  if (!agentFlag) {
    const { agentInput } = await inquirer.prompt<{ agentInput: AvailableAgent }>([
      {
        type: 'list',
        name: 'agentInput',
        message: 'Which agent would you like to use?',
        choices: AVAILABLE_AGENTS.map((entry) => ({ name: entry.name, value: entry.value })),
        default: 'claude',
      },
    ])
    return agentInput
  }
  const valid = validateAgent(agentFlag)
  if (valid !== true) return logAndThrowError(valid)
  return agentFlag as AvailableAgent
}

const resolveBranch = async (branchFlag: string | undefined, siteBranch: string | undefined): Promise<string> => {
  if (branchFlag) return branchFlag

  const localGit = detectLocalGit()
  const defaultBranch = localGit.branch ?? siteBranch

  if (localGit.isInsideRepo) {
    if (localGit.isDirty) {
      log(chalk.yellow('⚠ Local working tree has uncommitted changes. The agent runs against the remote branch.'))
    }
    if (localGit.hasUnpushedCommits) {
      log(chalk.yellow('⚠ Local branch has unpushed commits. The agent runs against the remote branch.'))
    }
  }

  const { branchInput } = await inquirer.prompt<{ branchInput: string }>([
    {
      type: 'input',
      name: 'branchInput',
      message: 'Which branch would you like to work on?',
      default: defaultBranch,
      validate: (input: string) => (input.trim().length > 0 ? true : 'Branch name is required'),
    },
  ])

  return branchInput.trim()
}
