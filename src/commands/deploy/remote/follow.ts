import type { NetlifyAPI } from '@netlify/api'

import { streamDeploy } from '../../logs/sources/deploy.js'
import { waitForDeploy } from '../../../utils/deploy/util.js'

// The log stream is best-effort; the deploy's state decides success.
export const followDeploy = async (
  api: NetlifyAPI,
  {
    siteId,
    deployId,
    timeoutMs,
    onLogLine,
  }: { siteId: string; deployId: string; timeoutMs: number; onLogLine?: (line: string) => void },
) => {
  const stopStreaming = onLogLine
    ? streamDeploy(
        siteId,
        deployId,
        api.accessToken,
        (entry) => {
          onLogLine(entry.message)
        },
        () => undefined,
      )
    : undefined
  try {
    return await waitForDeploy(api, deployId, siteId, timeoutMs)
  } finally {
    stopStreaming?.()
  }
}
