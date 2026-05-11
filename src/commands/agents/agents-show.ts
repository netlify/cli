import type { OptionValues } from 'commander'

import { chalk, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi, type AgentsApi } from './api.js'
import { TERMINAL_AGENT_STATES, TERMINAL_SESSION_STATES } from './constants.js'
import type { AgentRunner, AgentRunnerSession } from './types.js'
import { formatDate, formatDuration, formatStatus, formatUsage, getAgentName } from './utils.js'

interface AgentShowOptions extends OptionValues {
  json?: boolean
  watch?: boolean
  session?: string
}

const POLL_INTERVAL_MS = 3000
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

class WatchRenderer {
  private currentText = ''
  private frame = 0
  private spinnerTimer: NodeJS.Timeout | null = null
  private active = false

  start(): void {
    if (!process.stdout.isTTY) return
    this.active = true
    this.spinnerTimer = setInterval(() => {
      this.frame = (this.frame + 1) % SPINNER_FRAMES.length
      this.draw()
    }, 80)
  }

  stop(): void {
    if (this.spinnerTimer) clearInterval(this.spinnerTimer)
    this.spinnerTimer = null
    if (this.active && process.stdout.isTTY) {
      process.stdout.write('\r\x1b[K')
    }
    this.active = false
  }

  setText(text: string): void {
    this.currentText = text
    this.draw()
  }

  print(line: string): void {
    if (this.active && process.stdout.isTTY) {
      process.stdout.write(`\r\x1b[K${line}\n`)
      this.draw()
    } else {
      log(line)
    }
  }

  private draw(): void {
    if (!this.active || !process.stdout.isTTY) return
    process.stdout.write(`\r\x1b[K${chalk.cyan(SPINNER_FRAMES[this.frame])} ${chalk.dim(this.currentText)}`)
  }
}

export const agentsShow = async (id: string, options: AgentShowOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent task ID is required')
  await command.authenticate()
  const api = createAgentsApi(command.netlify)

  if (options.session) {
    return showSingleSession(api, id, options.session, options, command)
  }

  if (options.watch) {
    if (options.json) {
      return logAndThrowError('--watch and --json cannot be combined')
    }
    return watchAgentTask(api, id, command)
  }

  return showAgentTask(api, id, options, command)
}

const showAgentTask = async (api: AgentsApi, id: string, options: AgentShowOptions, command: BaseCommand) => {
  const spinner = startSpinner({ text: 'Fetching agent task details...' })
  try {
    const [runner, sessions] = await Promise.all([
      api.getAgentRunner(id),
      api.listAgentRunnerSessions(id, { page: 1, per_page: 100, order_by: 'desc' }),
    ])
    stopSpinner({ spinner })

    if (options.json) {
      const payload = { ...runner, sessions }
      logJson(payload)
      return payload
    }

    renderAgentTask(runner, sessions, command)
    return runner
  } catch (error_) {
    const error = error_ as Error & { status?: number }
    stopSpinner({ spinner, error: true })
    if (error.status === 404) {
      return logAndThrowError(`Agent task not found: ${id}`)
    }
    return logAndThrowError(`Failed to show agent task: ${error.message}`)
  }
}

const showSingleSession = async (
  api: AgentsApi,
  id: string,
  sessionId: string,
  options: AgentShowOptions,
  command: BaseCommand,
) => {
  const spinner = startSpinner({ text: 'Fetching session details...' })
  try {
    const session = await api.getAgentRunnerSession(id, sessionId)
    stopSpinner({ spinner })

    if (options.json) {
      logJson(session)
      return session
    }

    renderSessionDetail(session, id, command)
    return session
  } catch (error_) {
    const error = error_ as Error & { status?: number }
    stopSpinner({ spinner, error: true })
    if (error.status === 404) {
      return logAndThrowError(`Session not found: ${sessionId}`)
    }
    return logAndThrowError(`Failed to show session: ${error.message}`)
  }
}

const renderAgentTask = (runner: AgentRunner, sessions: AgentRunnerSession[], command: BaseCommand) => {
  const { siteInfo, site } = command.netlify

  log(chalk.bold('Agent Task Details'))
  log()

  log(chalk.bold('Basic Information:'))
  log(`  Task ID: ${chalk.cyan(runner.id)}`)
  log(`  Status: ${formatStatus(runner.state ?? 'unknown')}`)
  log(`  Site: ${chalk.cyan(siteInfo.name)} (${site.id ?? ''})`)
  if (runner.user) log(`  Created by: ${runner.user.full_name ?? 'Anonymous'}`)
  if (runner.contributors && runner.contributors.length > 1) {
    log(`  Contributors: ${runner.contributors.map((entry) => entry.full_name ?? 'Anonymous').join(', ')}`)
  }

  log()
  log(chalk.bold('Configuration:'))
  const config = sessions[0]?.agent_config
  if (config?.agent) log(`  Agent: ${chalk.cyan(getAgentName(config.agent))}`)
  if (config?.model) log(`  Model: ${chalk.cyan(config.model)}`)

  const isGitBased = Boolean(siteInfo.build_settings?.repo_branch)
  if (isGitBased) {
    log(`  Branch: ${chalk.cyan(runner.branch ?? 'unknown')}`)
  } else {
    log(`  Base: ${chalk.cyan('Latest production deployment')}`)
  }

  log()
  log(chalk.bold('Task:'))
  log(`  Title: ${chalk.dim(runner.title ?? 'No title')}`)
  if (runner.current_task) log(`  Current Task: ${chalk.yellow(runner.current_task)}`)

  log()
  log(chalk.bold('Timeline:'))
  log(`  Created: ${formatDate(runner.created_at)}`)
  log(`  Updated: ${formatDate(runner.updated_at)}`)
  if (runner.done_at) {
    log(`  Completed: ${formatDate(runner.done_at)}`)
    log(`  Duration: ${formatDuration(runner.created_at, runner.done_at)}`)
  } else if (runner.state === 'running') {
    log(`  Running for: ${formatDuration(runner.created_at)}`)
  }

  if (sessions.length > 0) {
    log()
    log(chalk.bold(`Sessions (${sessions.length.toString()}):`))
    for (const [index, session] of sessions.entries()) {
      log()
      renderSessionInline(session, index + 1, sessions.length)
    }
  }

  if (runner.pr_url || runner.pr_error) {
    log()
    log(chalk.bold('Pull Request:'))
    if (runner.pr_url) log(`  URL: ${chalk.blue(runner.pr_url)}`)
    if (runner.pr_state) log(`  State: ${chalk.cyan(runner.pr_state)}`)
    if (runner.pr_error) log(`  ${chalk.red('Error:')} ${runner.pr_error}`)
  }

  if (runner.merge_commit_sha || runner.merge_commit_error) {
    log()
    log(chalk.bold('Branch Commit:'))
    if (runner.merge_commit_sha) log(`  SHA: ${chalk.cyan(runner.merge_commit_sha)}`)
    if (runner.merge_commit_error) log(`  ${chalk.red('Error:')} ${runner.merge_commit_error}`)
  }

  if (runner.needs_git_sync || runner.rebase_available || runner.merge_target_available) {
    log()
    log(chalk.bold('Sync needed:'))
    if (runner.needs_git_sync) {
      log(`  ${chalk.yellow('!')} Code origin changed since this run started.`)
    } else if (runner.merge_target_available) {
      log(`  ${chalk.yellow('!')} The target branch has new commits.`)
    } else if (runner.rebase_available) {
      log(`  ${chalk.yellow('!')} Production has moved on since this run started.`)
    }
    log(`  Run: ${chalk.cyan(`netlify agents:sync ${runner.id}`)}`)
  }

  log()
  log(chalk.bold('Actions:'))
  if (runner.state === 'running' || runner.state === 'new') {
    log(`  Stop: ${chalk.cyan(`netlify agents:stop ${runner.id}`)}`)
    log(`  Watch: ${chalk.cyan(`netlify agents:show ${runner.id} --watch`)}`)
  }
  if (runner.has_result_diff) {
    log(`  View diff: ${chalk.cyan(`netlify agents:diff ${runner.id}`)}`)
  }
  if (runner.latest_session_deploy_url) {
    log(`  Open preview: ${chalk.cyan(`netlify agents:open ${runner.id}`)}`)
  }
  log(`  View in browser: ${chalk.blue(`https://app.netlify.com/projects/${siteInfo.name}/agent-runs/${runner.id}`)}`)
}

const renderSessionInline = (session: AgentRunnerSession, index: number, total: number) => {
  const header = `  ${index.toString()}/${total.toString()} ${chalk.bold(session.title ?? session.prompt.slice(0, 80))}`
  log(header)
  const meta: string[] = [formatStatus(session.state)]
  if (session.mode && session.mode !== 'normal') meta.push(chalk.dim(`mode: ${session.mode}`))
  if (session.done_at) {
    meta.push(chalk.dim(`took ${formatDuration(session.created_at, session.done_at)}`))
  } else if (session.state === 'running') {
    meta.push(chalk.dim(`running for ${formatDuration(session.created_at)}`))
  }
  log(`     ${meta.join(' • ')}`)
  log(`     ${chalk.dim('id:')} ${session.id}`)
  if (session.deploy_url) log(`     ${chalk.dim('preview:')} ${chalk.blue(session.deploy_url)}`)
  if (session.commit_sha) log(`     ${chalk.dim('commit:')} ${chalk.cyan(session.commit_sha)}`)

  if (session.steps && session.steps.length > 0) {
    log(`     ${chalk.dim('Steps:')}`)
    for (const step of session.steps) {
      const title = step.title ?? '(untitled step)'
      log(`       ${chalk.green('✓')} ${title}`)
      if (step.message) log(`         ${chalk.dim(step.message)}`)
    }
  }

  for (const line of formatUsage(session.usage)) {
    log(`     ${chalk.dim(line)}`)
  }

  if (session.result && session.state === 'done') {
    const resultPreview = session.result.length > 200 ? `${session.result.substring(0, 200)}...` : session.result
    log(`     ${chalk.dim('Result:')} ${chalk.dim(resultPreview)}`)
  }
}

const renderSessionDetail = (session: AgentRunnerSession, runnerId: string, command: BaseCommand) => {
  const { siteInfo } = command.netlify
  log(chalk.bold('Session Details'))
  log()
  log(`  Session ID: ${chalk.cyan(session.id)}`)
  log(`  Task ID: ${chalk.cyan(runnerId)}`)
  log(`  Status: ${formatStatus(session.state)}`)
  if (session.mode) log(`  Mode: ${chalk.cyan(session.mode)}`)
  if (session.agent_config?.agent) log(`  Agent: ${chalk.cyan(getAgentName(session.agent_config.agent))}`)
  if (session.agent_config?.model) log(`  Model: ${chalk.cyan(session.agent_config.model)}`)

  log()
  log(chalk.bold('Prompt:'))
  log(`  ${session.prompt}`)

  log()
  log(chalk.bold('Timeline:'))
  log(`  Created: ${formatDate(session.created_at)}`)
  log(`  Updated: ${formatDate(session.updated_at)}`)
  if (session.done_at) {
    log(`  Completed: ${formatDate(session.done_at)}`)
    log(`  Duration: ${formatDuration(session.created_at, session.done_at)}`)
  }

  if (session.steps && session.steps.length > 0) {
    log()
    log(chalk.bold('Steps:'))
    for (const step of session.steps) {
      log(`  ${chalk.green('✓')} ${step.title ?? '(untitled step)'}`)
      if (step.message) log(`    ${chalk.dim(step.message)}`)
    }
  }

  if (session.deploy_url) {
    log()
    log(chalk.bold('Deploy:'))
    log(`  URL: ${chalk.blue(session.deploy_url)}`)
  }

  if (session.commit_sha) {
    log()
    log(chalk.bold('Commit:'))
    log(`  SHA: ${chalk.cyan(session.commit_sha)}`)
  }

  const usage = formatUsage(session.usage)
  if (usage.length > 0) {
    log()
    log(chalk.bold('Usage:'))
    for (const line of usage) log(`  ${line}`)
  }

  if (session.result) {
    log()
    log(chalk.bold('Result:'))
    log(`  ${session.result}`)
  }

  log()
  log(`  View in browser: ${chalk.blue(`https://app.netlify.com/projects/${siteInfo.name}/agent-runs/${runnerId}`)}`)
}

interface WatchSnapshot {
  state?: string
  currentTask?: string
  sessionStates: Map<string, string>
  sessionIds: string[]
  sessionStepCounts: Map<string, number>
}

const takeSnapshot = (runner: AgentRunner, sessions: AgentRunnerSession[]): WatchSnapshot => {
  const sessionStates = new Map<string, string>()
  const sessionStepCounts = new Map<string, number>()
  for (const session of sessions) {
    sessionStates.set(session.id, session.state)
    sessionStepCounts.set(session.id, session.steps?.length ?? 0)
  }
  return {
    state: runner.state,
    currentTask: runner.current_task,
    sessionStates,
    sessionIds: sessions.map((session) => session.id),
    sessionStepCounts,
  }
}

const watchAgentTask = async (api: AgentsApi, id: string, command: BaseCommand) => {
  const renderer = new WatchRenderer()
  let previous: WatchSnapshot | null = null
  let [lastRunner, lastSessions] = await Promise.all([
    api.getAgentRunner(id),
    api.listAgentRunnerSessions(id, { page: 1, per_page: 100 }),
  ])

  log(`${chalk.cyan('Watching')} agent task ${chalk.bold(id)} ${chalk.dim('(Ctrl+C to stop)')}`)
  log()

  renderer.start()
  try {
    for (;;) {
      const events = computeWatchEvents(lastRunner, lastSessions, previous)
      for (const event of events) renderer.print(event)

      renderer.setText(describeBottomLine(lastRunner, lastSessions))
      previous = takeSnapshot(lastRunner, lastSessions)

      if (TERMINAL_AGENT_STATES.includes(lastRunner.state as (typeof TERMINAL_AGENT_STATES)[number])) {
        break
      }
      await sleep(POLL_INTERVAL_MS)
      try {
        ;[lastRunner, lastSessions] = await Promise.all([
          api.getAgentRunner(id),
          api.listAgentRunnerSessions(id, { page: 1, per_page: 100, order_by: 'desc' }),
        ])
      } catch (error_) {
        const error = error_ as Error
        renderer.print(`${chalk.yellow('!')} ${chalk.dim(`poll failed: ${error.message} — retrying`)}`)
      }
    }
  } finally {
    renderer.stop()
  }

  log()
  renderAgentTask(lastRunner, lastSessions, command)
  return lastRunner
}

const describeBottomLine = (runner: AgentRunner, sessions: AgentRunnerSession[]): string => {
  const active = sessions.find(
    (session) => !TERMINAL_SESSION_STATES.includes(session.state as (typeof TERMINAL_SESSION_STATES)[number]),
  )
  if (active) {
    const step = active.steps?.[active.steps.length - 1]
    const detail = runner.current_task ?? step?.title ?? 'working...'
    return `Session ${active.id.slice(-6)}: ${detail}`
  }
  return `state: ${runner.state ?? 'unknown'}`
}

const computeWatchEvents = (
  runner: AgentRunner,
  sessions: AgentRunnerSession[],
  previous: WatchSnapshot | null,
): string[] => {
  const events: string[] = []
  if (!previous) {
    events.push(`${chalk.dim('•')} state: ${formatStatus(runner.state ?? 'unknown')}`)
    for (const session of sessions) {
      events.push(`${chalk.dim('•')} session ${session.id.slice(-6)} ${formatStatus(session.state)}`)
    }
    return events
  }

  if (previous.state !== runner.state) {
    events.push(
      `${chalk.dim('•')} state: ${formatStatus(previous.state ?? 'unknown')} → ${formatStatus(
        runner.state ?? 'unknown',
      )}`,
    )
  }

  const previousIds = new Set(previous.sessionIds)
  for (const session of sessions) {
    if (!previousIds.has(session.id)) {
      events.push(`${chalk.dim('•')} new session ${session.id.slice(-6)} ${formatStatus(session.state)}`)
      continue
    }
    const previousState = previous.sessionStates.get(session.id)
    if (previousState && previousState !== session.state) {
      const duration = session.done_at ? ` in ${formatDuration(session.created_at, session.done_at)}` : ''
      events.push(
        `${chalk.dim('•')} session ${session.id.slice(-6)}: ${formatStatus(previousState)} → ${formatStatus(
          session.state,
        )}${duration}`,
      )
    }
    const previousStepCount = previous.sessionStepCounts.get(session.id) ?? 0
    const currentStepCount = session.steps?.length ?? 0
    if (currentStepCount > previousStepCount && session.steps) {
      for (let stepIndex = previousStepCount; stepIndex < currentStepCount; stepIndex += 1) {
        const step = session.steps[stepIndex]
        events.push(
          `${chalk.green('✓')} ${step.title ?? '(step)'}${step.message ? chalk.dim(` - ${step.message}`) : ''}`,
        )
      }
    }
  }

  return events
}
