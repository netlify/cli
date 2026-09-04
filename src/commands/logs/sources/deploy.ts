import type { NetlifyAPI } from '@netlify/api'

import { getWebSocket } from '../../../utils/websockets/index.js'
import type { LogEntry } from '../log-api.js'

interface DeployLogMessage {
  ts?: string | number
  log?: string
  message?: string
  level?: string
  section?: string
  type?: string
}

const DEPLOY_LOG_REPLAY_TIMEOUT_MS = 30_000

const parseDeployLogTimestamp = (message: DeployLogMessage): number | undefined => {
  if (!message.ts) {
    return undefined
  }
  const ts = new Date(message.ts).getTime()
  return Number.isNaN(ts) ? undefined : ts
}

const toLogEntry = (message: DeployLogMessage, ts: number): LogEntry => ({
  source: 'deploy',
  name: 'deploy',
  ts,
  level: message.level ?? 'INFO',
  message: message.log ?? message.message ?? '',
  section: message.section,
})

const isEndOfBuild = (message: DeployLogMessage): boolean => message.type === 'report' && message.section === 'building'

const parseDeployLogMessage = (data: string): DeployLogMessage | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return null
  }
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null
}

export const fetchDeployHistoricalLogs = async ({
  siteId,
  accessToken,
  deployId,
  from,
  to,
}: {
  siteId: string
  accessToken: string | null | undefined
  deployId: string
  from: number
  to: number
}): Promise<LogEntry[]> => {
  const collected: { entry: LogEntry; hasTimestamp: boolean }[] = []
  const ws = getWebSocket('wss://socketeer.services.netlify.com/build/logs')

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      ws.close()
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }
    const timeout = setTimeout(() => {
      finish()
    }, DEPLOY_LOG_REPLAY_TIMEOUT_MS)

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          deploy_id: deployId,
          site_id: siteId,
          access_token: accessToken,
        }),
      )
    })

    ws.on('message', (data: string) => {
      const message = parseDeployLogMessage(data)
      if (!message) {
        return
      }
      if (isEndOfBuild(message)) {
        finish()
        return
      }
      const parsedTs = parseDeployLogTimestamp(message)
      collected.push({
        entry: toLogEntry(message, parsedTs ?? Date.now()),
        hasTimestamp: parsedTs !== undefined,
      })
    })

    ws.on('close', () => {
      finish()
    })
    ws.on('error', (error: Error) => {
      finish(error)
    })
  })

  return collected
    .filter(({ entry, hasTimestamp }) => !hasTimestamp || (entry.ts >= from && entry.ts <= to))
    .map(({ entry }) => entry)
    .sort((a, b) => a.ts - b.ts)
}

export const streamDeploy = (
  siteId: string,
  deployId: string,
  accessToken: string | null | undefined,
  onEntry: (entry: LogEntry) => void,
  onClose: () => void,
): (() => void) => {
  const ws = getWebSocket('wss://socketeer.services.netlify.com/build/logs')

  ws.on('open', () => {
    ws.send(
      JSON.stringify({
        deploy_id: deployId,
        site_id: siteId,
        access_token: accessToken,
      }),
    )
  })

  ws.on('message', (data: string) => {
    const message = parseDeployLogMessage(data)
    if (!message) {
      return
    }
    onEntry(toLogEntry(message, parseDeployLogTimestamp(message) ?? Date.now()))

    if (isEndOfBuild(message)) {
      ws.close()
    }
  })

  ws.on('close', () => {
    onClose()
  })

  return () => {
    ws.close()
  }
}

export const findCurrentBuildingDeploy = async (client: NetlifyAPI, siteId: string): Promise<string | undefined> => {
  const deploys = (await client.listSiteDeploys({ siteId, state: 'building' })) as { id: string }[]
  return deploys.length > 0 ? deploys[0].id : undefined
}

export const findLatestReadyDeploy = async (client: NetlifyAPI, siteId: string): Promise<string | undefined> => {
  const deploys = (await client.listSiteDeploys({ siteId, state: 'ready', per_page: 1 })) as { id: string }[]
  return deploys.length > 0 ? deploys[0].id : undefined
}
