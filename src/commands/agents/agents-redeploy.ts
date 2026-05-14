import type { OptionValues } from 'commander'

import { chalk, log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi } from './api.js'
import { formatStatus } from './utils.js'

interface AgentRedeployOptions extends OptionValues {
  session?: string
  json?: boolean
}

export const agentsRedeploy = async (id: string, options: AgentRedeployOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent run ID is required')
  await command.authenticate()
  const api = createAgentsApi(command.netlify)

  let sessionId = options.session
  if (!sessionId) {
    const lookupSpinner = startSpinner({ text: 'Finding latest completed session...' })
    try {
      const perPage = 100
      const maxPages = 10
      let page = 1
      let latestDone: { id: string } | undefined
      while (!latestDone && page <= maxPages) {
        const sessions = await api.listAgentRunnerSessions(id, { page, per_page: perPage, order_by: 'desc' })
        latestDone = sessions.find((session) => session.state === 'done')
        if (latestDone || sessions.length < perPage) break
        page += 1
      }
      stopSpinner({ spinner: lookupSpinner })
      if (!latestDone) {
        return logAndThrowError('No completed session found to redeploy. Pass --session <id> to target a specific one.')
      }
      sessionId = latestDone.id
    } catch (error_) {
      stopSpinner({ spinner: lookupSpinner, error: true })
      const error = error_ as Error
      return logAndThrowError(`Failed to list sessions: ${error.message}`)
    }
  }

  const spinner = startSpinner({ text: 'Creating redeploy session...' })
  try {
    const session = await api.redeployAgentRunnerSession(id, sessionId)
    stopSpinner({ spinner })

    if (options.json) {
      logJson(session)
      return session
    }

    log(`${chalk.green('✓')} Redeploy session created!`)
    log()
    log(`  Run ID: ${chalk.cyan(id)}`)
    log(`  Session ID: ${chalk.cyan(session.id)}`)
    log(`  Source Session: ${chalk.dim(sessionId)}`)
    log(`  Status: ${formatStatus(session.state)}`)
    log()
    log(`Watch progress: ${chalk.cyan(`netlify agents:show ${id} --watch`)}`)
    return session
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error & { status?: number }
    if (error.status === 404) return logAndThrowError(`Agent run or session not found: ${id} / ${sessionId}`)
    return logAndThrowError(`Failed to redeploy: ${error.message}`)
  }
}
