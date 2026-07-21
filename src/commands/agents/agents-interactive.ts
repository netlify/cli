import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, log, logAndThrowError } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner, type Spinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import type { AgentRunner, AgentRunnerSession } from './types.js'
import { formatStatus, getAgentName, validatePrompt } from './utils.js'

interface AgentInteractiveOptions extends OptionValues {
  agent?: string
  model?: string
}

const POLL_INTERVAL_MS = 3000
const TERMINAL_SESSION_STATES = new Set(['done', 'error', 'cancelled'])

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

interface RequestContext {
  baseUrl: string
  accessToken: string
  userAgent: string
}

const buildRequestContext = (command: BaseCommand): RequestContext => {
  const { api, apiOpts } = command.netlify
  return {
    baseUrl: `${apiOpts.scheme ?? 'https'}://${apiOpts.host ?? api.host}`,
    accessToken: api.accessToken ?? '',
    userAgent: apiOpts.userAgent,
  }
}

interface RequestOptions {
  method?: string
  body?: string
  headers?: Record<string, string>
}

const request = async (ctx: RequestContext, path: string, init: RequestOptions = {}): Promise<unknown> => {
  const response = await fetch(`${ctx.baseUrl}${path}`, {
    method: init.method,
    body: init.body,
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      'User-Agent': ctx.userAgent,
      ...init.headers,
    },
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(errorData.error ?? `HTTP ${response.status.toString()}: ${response.statusText}`)
  }

  return response.status === 204 ? undefined : await response.json().catch(() => undefined)
}

const createRun = async (ctx: RequestContext, siteId: string, body: Record<string, unknown>): Promise<AgentRunner> => {
  const params = new URLSearchParams({ site_id: siteId })
  return (await request(ctx, `/api/v1/agent_runners?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })) as AgentRunner
}

const createFollowUpSession = async (
  ctx: RequestContext,
  runnerId: string,
  body: Record<string, unknown>,
): Promise<void> => {
  await request(ctx, `/api/v1/agent_runners/${runnerId}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const getLatestSession = async (ctx: RequestContext, runnerId: string): Promise<AgentRunnerSession | undefined> => {
  const sessions = (await request(ctx, `/api/v1/agent_runners/${runnerId}/sessions?page=1&per_page=1`)) as
    | AgentRunnerSession[]
    | undefined
  return sessions?.[0]
}

const printSessionResult = (session: AgentRunnerSession): void => {
  log('')
  if (session.state === 'done') {
    log(`${chalk.green('✓')} ${chalk.bold(session.title ?? 'Session complete')}`)
    if (session.result) {
      log('')
      log(session.result)
    }
  } else if (session.state === 'error') {
    log(`${chalk.red('✗')} ${chalk.bold('The agent ran into an error.')}`)
    if (session.result) {
      log('')
      log(session.result)
    }
  } else {
    log(`${chalk.yellow('•')} ${chalk.bold('The session was cancelled.')}`)
  }
  log('')
}

const waitForSession = async (
  ctx: RequestContext,
  runnerId: string,
  predicate: (session: AgentRunnerSession) => boolean,
): Promise<AgentRunnerSession> => {
  let session = await getLatestSession(ctx, runnerId)
  while (!session || !predicate(session)) {
    await delay(POLL_INTERVAL_MS)
    session = await getLatestSession(ctx, runnerId)
  }
  return session
}

const followSession = async (
  ctx: RequestContext,
  runnerId: string,
  currentSession: AgentRunnerSession,
): Promise<AgentRunnerSession> => {
  const spinner = startSpinner({ text: 'The agent is getting started…' })
  let printedSteps = 0
  let session = currentSession

  try {
    while (!TERMINAL_SESSION_STATES.has(session.state)) {
      const steps = session.steps ?? []
      for (const step of steps.slice(printedSteps)) {
        const label = step.title ?? step.message
        if (label) {
          spinner.update({ text: label })
        }
      }
      printedSteps = steps.length

      await delay(POLL_INTERVAL_MS)
      const next = await getLatestSession(ctx, runnerId)
      if (next) {
        session = next
      }
    }

    stopSpinner({ spinner })
  } catch (error) {
    stopSpinner({ spinner, error: true })
    throw error
  }

  printSessionResult(session)
  return session
}

const askPrompt = async (message: string): Promise<string> => {
  const { promptInput } = await inquirer.prompt<{ promptInput: string }>([
    {
      type: 'input',
      name: 'promptInput',
      message,
    },
  ])
  return promptInput.trim()
}

export const agentsInteractive = async (options: AgentInteractiveOptions, command: BaseCommand) => {
  const { site, siteInfo } = command.netlify

  await command.authenticate()

  const ctx = buildRequestContext(command)
  const siteId = site.id ?? ''
  const agent = options.agent ?? 'claude'
  const model = options.model
  const isGitBased = Boolean(siteInfo.build_settings?.repo_branch)
  const branch = isGitBased ? siteInfo.build_settings?.repo_branch : undefined

  console.clear()
  log(chalk.bold(`Welcome to the Netlify agent for ${chalk.cyan(siteInfo.name)}.`))
  log(chalk.dim(`Running ${getAgentName(agent)} on ${isGitBased ? `branch ${branch ?? ''}` : 'your production deployment'}.`))
  log('')

  const initialPrompt = await askPrompt('What do you want to build today?')
  const initialPromptIsValid = validatePrompt(initialPrompt)
  if (initialPromptIsValid !== true) {
    return logAndThrowError(initialPromptIsValid)
  }

  let runner: AgentRunner
  const createRunSpinner: Spinner = startSpinner({ text: 'Spinning up a new agent run…' })
  try {
    runner = await createRun(ctx, siteId, {
      ...(branch ? { branch } : {}),
      prompt: initialPrompt,
      agent,
      model,
    })
    stopSpinner({ spinner: createRunSpinner })
  } catch (error_) {
    stopSpinner({ spinner: createRunSpinner, error: true })
    return logAndThrowError(`Failed to start agent run: ${(error_ as Error).message}`)
  }

  log(chalk.dim(`Run ${chalk.cyan(runner.id)} — ${formatStatus(runner.state ?? 'new')}`))

  try {
    const firstSession = await waitForSession(ctx, runner.id, () => true)
    const completed = await followSession(ctx, runner.id, firstSession)

    let previousSessionId = completed.id

    const isExit = (input: string): boolean => input === '' || input.toLowerCase() === 'exit'

    let followUp = await askPrompt("What's next? (press Enter or type 'exit' to finish)")
    while (!isExit(followUp)) {
      const startSessionSpinner = startSpinner({ text: 'Sending your follow-up to the agent…' })
      try {
        await createFollowUpSession(ctx, runner.id, { prompt: followUp, agent, model })
        stopSpinner({ spinner: startSessionSpinner })

        const newSession = await waitForSession(ctx, runner.id, (candidate) => candidate.id !== previousSessionId)
        const finished = await followSession(ctx, runner.id, newSession)
        previousSessionId = finished.id
      } catch (error_) {
        stopSpinner({ spinner: startSessionSpinner, error: true })
        log(chalk.red(`Failed to send follow-up: ${(error_ as Error).message}`))
      }

      followUp = await askPrompt("What's next? (press Enter or type 'exit' to finish)")
    }
  } catch (error_) {
    return logAndThrowError(`Agent run failed: ${(error_ as Error).message}`)
  }

  log('')
  log(chalk.dim('Thanks for building with Netlify. Picking this run back up any time:'))
  log(`  ${chalk.cyan(`netlify agents:show ${runner.id}`)}`)
  log(
    `  ${chalk.blue(`https://app.netlify.com/projects/${siteInfo.name}/agent-runs/${runner.id}`)}`,
  )

  return runner
}
