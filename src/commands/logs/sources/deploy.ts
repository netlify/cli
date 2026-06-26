import type { NetlifyAPI } from '@netlify/api'

import { getWebSocket } from '../../../utils/websockets/index.js'
import { debugFetch } from '../log-api.js'
import type { LogEntry } from '../log-api.js'

interface DeployLogLine {
  ts: string
  log?: string
  message?: string
  level?: string
  section?: string
  type?: string
}

export const fetchDeployHistoricalLogs = async ({
  apiBase,
  accessToken,
  deployId,
  from,
  to,
}: {
  apiBase: string
  accessToken: string | null | undefined
  deployId: string
  from: number
  to: number
}): Promise<LogEntry[]> => {
  const response = await debugFetch(`${apiBase}/api/v1/deploys/${encodeURIComponent(deployId)}/log`, {
    headers: {
      Authorization: `Bearer ${accessToken ?? ''}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch deploy logs: ${response.status.toString()} ${response.statusText}`)
  }

  const logData = (await response.json()) as DeployLogLine[]
  if (!Array.isArray(logData)) {
    return []
  }

  return logData
    .map((line): LogEntry | null => {
      const ts = new Date(line.ts).getTime()
      if (Number.isNaN(ts) || ts < from || ts > to) {
        return null
      }
      return {
        source: 'deploy',
        name: 'deploy',
        ts,
        level: line.level ?? 'INFO',
        message: line.log ?? line.message ?? '',
        section: line.section,
      }
    })
    .filter((entry): entry is LogEntry => entry !== null)
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
    const logData = JSON.parse(data) as {
      message: string
      section?: string
      type?: string
      level?: string
      ts?: string
    }

    onEntry({
      source: 'deploy',
      name: 'deploy',
      ts: logData.ts ? new Date(logData.ts).getTime() : Date.now(),
      level: logData.level ?? 'INFO',
      message: logData.message,
      section: logData.section,
    })

    if (logData.type === 'report' && logData.section === 'building') {
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
