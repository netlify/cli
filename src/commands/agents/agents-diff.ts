import type { OptionValues } from 'commander'

import { chalk, log, logAndThrowError } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import { createAgentsApi, type AgentsApi } from './api.js'
import { formatDiff } from './utils.js'

interface AgentDiffOptions extends OptionValues {
  page?: string
  perPage?: string
  session?: string
  cumulative?: boolean
  stripBinary?: boolean
  color?: boolean
}

const parsePositiveInt = (input: string | undefined, name: string): number | undefined => {
  if (input === undefined) return undefined
  if (!/^[1-9]\d*$/.test(input)) {
    throw new Error(`--${name} must be a positive integer`)
  }
  return Number.parseInt(input, 10)
}

const verifyRunnerExists = async (api: AgentsApi, id: string): Promise<void> => {
  try {
    await api.getAgentRunner(id)
  } catch (error_) {
    const error = error_ as Error & { status?: number }
    if (error.status === 404) {
      throw new Error(`Agent run not found: ${id}`)
    }
    throw error
  }
}

export const agentsDiff = async (id: string, options: AgentDiffOptions, command: BaseCommand) => {
  if (!id) return logAndThrowError('Agent run ID is required')
  await command.authenticate()
  const api = createAgentsApi(command.netlify)

  const useColor = options.color !== false && process.stdout.isTTY

  if (options.session) {
    const kind = options.cumulative ? 'cumulative' : 'result'
    const spinner = startSpinner({ text: `Fetching session ${kind} diff...` })
    try {
      const diff = options.cumulative
        ? await api.getSessionCumulativeDiff(id, options.session)
        : await api.getSessionResultDiff(id, options.session)
      stopSpinner({ spinner })
      if (!diff) {
        await verifyRunnerExists(api, id)
        log(chalk.yellow('No diff available for this session.'))
        return
      }
      process.stdout.write(useColor ? formatDiff(diff) : diff)
      if (!diff.endsWith('\n')) process.stdout.write('\n')
      return
    } catch (error_) {
      stopSpinner({ spinner, error: true })
      const error = error_ as Error
      if (error.message.startsWith('Agent run not found:')) {
        return logAndThrowError(error.message)
      }
      return logAndThrowError(`Failed to fetch diff: ${error.message}`)
    }
  }

  let page: number | undefined
  let perPage: number | undefined
  try {
    page = parsePositiveInt(options.page, 'page') ?? 1
    perPage = parsePositiveInt(options.perPage, 'per-page')
  } catch (error_) {
    return logAndThrowError((error_ as Error).message)
  }

  const spinner = startSpinner({ text: 'Fetching agent run diff...' })
  try {
    const result = await api.getAgentRunnerDiff(id, {
      page,
      per_page: perPage,
      strip_binary: options.stripBinary !== false,
    })
    stopSpinner({ spinner })

    if (!result.data) {
      await verifyRunnerExists(api, id)
      log(chalk.yellow('No diff available for this agent run.'))
      return
    }

    process.stdout.write(useColor ? formatDiff(result.data) : result.data)
    if (!result.data.endsWith('\n')) process.stdout.write('\n')

    log()
    log(chalk.dim(formatFooter(result.page, result.perPage, result.total, result.hasNext)))
    return result
  } catch (error_) {
    stopSpinner({ spinner, error: true })
    const error = error_ as Error
    if (error.message.startsWith('Agent run not found:')) {
      return logAndThrowError(error.message)
    }
    return logAndThrowError(`Failed to fetch diff: ${error.message}`)
  }
}

const formatFooter = (page: number, perPage: number, total: number | undefined, hasNext: boolean): string => {
  const parts: string[] = []
  if (total != null) {
    const start = (page - 1) * perPage + 1
    const end = Math.min(page * perPage, total)
    parts.push(`Showing files ${start.toString()}-${end.toString()} of ${total.toString()}`)
  } else {
    parts.push(`Showing page ${page.toString()}`)
  }
  if (hasNext) {
    parts.push(`Use --page ${(page + 1).toString()} for the next page`)
  }
  return parts.join(' • ')
}
