import type { NetlifyAPI } from '@netlify/api'

import { getWebSocket } from '../../../utils/websockets/index.js'
import { buildFunctionLogsUrl, fetchHistoricalLogs } from '../log-api.js'
import type { LogEntry } from '../log-api.js'

interface NetlifyFunction {
  a: string
  oid: string
  n: string
  branch?: string | null
}

const MAX_CONCURRENT_FUNCTIONS = 10

export const listFunctions = async (
  client: NetlifyAPI,
  siteId: string,
  deployId?: string,
): Promise<NetlifyFunction[]> => {
  if (deployId) {
    const deploy = (await client.getSiteDeploy({ siteId, deployId })) as { available_functions?: NetlifyFunction[] }
    return deploy.available_functions ?? []
  }
  const searchResponse = (await client.searchSiteFunctions({ siteId })) as { functions?: NetlifyFunction[] }
  return searchResponse.functions ?? []
}

export const selectFunctions = (allFunctions: NetlifyFunction[], filterNames: string[]): NetlifyFunction[] => {
  if (filterNames.length === 0) {
    return allFunctions
  }
  const selected: NetlifyFunction[] = []
  for (const name of filterNames) {
    const match = allFunctions.find((fn) => fn.n === name)
    if (!match) {
      throw new Error(`Could not find function ${name}`)
    }
    selected.push(match)
  }
  return selected
}

export const validateFunctionCount = (count: number): void => {
  if (count > MAX_CONCURRENT_FUNCTIONS) {
    throw new Error(
      `You can only stream logs for up to ${MAX_CONCURRENT_FUNCTIONS.toString()} functions at a time — this project has ${count.toString()}.`,
    )
  }
}

export const fetchFunctionHistoricalLogs = async ({
  functions,
  siteId,
  accessToken,
  from,
  to,
  deployId,
}: {
  functions: NetlifyFunction[]
  siteId: string
  accessToken: string | null | undefined
  from: number
  to: number
  deployId?: string
}): Promise<LogEntry[]> => {
  const results = await Promise.all(
    functions.map(async (fn) => {
      const baseUrl = buildFunctionLogsUrl({ siteId, branch: fn.branch, functionName: fn.n })
      const entries = await fetchHistoricalLogs({ baseUrl, accessToken, from, to, deployId })
      return entries.map(
        (entry): LogEntry => ({
          source: 'function',
          name: fn.n,
          ts: entry.ts,
          level: entry.level || 'INFO',
          message: entry.message,
        }),
      )
    }),
  )
  return results.flat()
}

export const streamFunctions = (
  functions: NetlifyFunction[],
  siteId: string,
  accessToken: string | null | undefined,
  onEntry: (entry: LogEntry) => void,
): (() => void) => {
  const sockets: ReturnType<typeof getWebSocket>[] = []

  for (const fn of functions) {
    const ws = getWebSocket('wss://socketeer.services.netlify.com/function/logs')
    sockets.push(ws)

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          function_id: fn.oid,
          site_id: siteId,
          access_token: accessToken,
          account_id: fn.a,
        }),
      )
    })

    ws.on('message', (data: string) => {
      const logData = JSON.parse(data) as { level: string; message: string; ts?: number }
      onEntry({
        source: 'function',
        name: fn.n,
        ts: typeof logData.ts === 'number' ? logData.ts : Date.now(),
        level: logData.level || 'INFO',
        message: logData.message,
      })
    })
  }

  return () => {
    for (const ws of sockets) {
      ws.close()
    }
  }
}
