import { getWebSocket } from '../../../utils/websockets/index.js'
import { buildEdgeFunctionLogsUrl, debugFetch, fetchHistoricalLogs } from '../log-api.js'
import type { LogEntry } from '../log-api.js'

interface NetlifyEdgeFunction {
  name: string
  generator?: string
}

export const listEdgeFunctions = async (
  apiBase: string,
  accessToken: string | null | undefined,
  deployId: string,
): Promise<NetlifyEdgeFunction[]> => {
  const response = await debugFetch(`${apiBase}/api/v1/deploys/${encodeURIComponent(deployId)}/edge_functions`, {
    headers: {
      Authorization: `Bearer ${accessToken ?? ''}`,
    },
  })
  if (!response.ok) {
    return []
  }
  const data = (await response.json()) as NetlifyEdgeFunction[] | { edge_functions?: NetlifyEdgeFunction[] }
  if (Array.isArray(data)) {
    return data
  }
  return (data as { edge_functions?: NetlifyEdgeFunction[] }).edge_functions ?? []
}

export const fetchEdgeFunctionHistoricalLogs = async ({
  siteId,
  accessToken,
  from,
  to,
  deployId,
  filterNames,
}: {
  siteId: string
  accessToken: string | null | undefined
  from: number
  to: number
  deployId?: string
  filterNames: string[]
}): Promise<LogEntry[]> => {
  if (filterNames.length > 0) {
    const results = await Promise.all(
      filterNames.map(async (name) => {
        const baseUrl = buildEdgeFunctionLogsUrl({ siteId, search: name })
        const entries = await fetchHistoricalLogs({ baseUrl, accessToken, from, to, deployId })
        return entries.map(
          (entry): LogEntry => ({
            source: 'edge-function',
            name: entry.function ?? name,
            ts: entry.ts,
            level: entry.level || 'INFO',
            message: entry.message,
          }),
        )
      }),
    )
    return results.flat()
  }

  const baseUrl = buildEdgeFunctionLogsUrl({ siteId })
  const entries = await fetchHistoricalLogs({ baseUrl, accessToken, from, to, deployId })
  return entries.map(
    (entry): LogEntry => ({
      source: 'edge-function',
      name: entry.function ?? 'edge-function',
      ts: entry.ts,
      level: entry.level || 'INFO',
      message: entry.message,
    }),
  )
}

export const streamEdgeFunctions = (
  siteId: string,
  deployId: string,
  accessToken: string | null | undefined,
  filterNames: string[],
  onEntry: (entry: LogEntry) => void,
): (() => void) => {
  const ws = getWebSocket('wss://socketeer.services.netlify.com/edge-function/logs')

  ws.on('open', () => {
    ws.send(
      JSON.stringify({
        deploy_id: deployId,
        site_id: siteId,
        access_token: accessToken,
        since: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      }),
    )
  })

  ws.on('message', (data: string) => {
    const logData = JSON.parse(data) as {
      level: string
      message: string
      ts?: number
      function?: string
      request_path?: string
    }
    const name = logData.function ?? 'edge-function'

    if (filterNames.length > 0 && !filterNames.some((f) => name === f || logData.request_path === f)) {
      return
    }

    onEntry({
      source: 'edge-function',
      name,
      ts: typeof logData.ts === 'number' ? logData.ts : Date.now(),
      level: logData.level || 'INFO',
      message: logData.message,
    })
  })

  return () => {
    ws.close()
  }
}
