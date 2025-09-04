import type { NetlifyAPI } from '@netlify/api'

import { warn } from '../utils/command-helpers.js'
import type { SiteInfo } from '../utils/types.js'

interface AIGatewayTokenResponse {
  token: string
  url: string // Returned by API but not used - contains site ID URL, we construct named host URL instead
}

export const cancelDeploy = async ({ api, deployId }: { api: NetlifyAPI; deployId: string }): Promise<void> => {
  try {
    await api.cancelSiteDeploy({ deploy_id: deployId })
  } catch (error) {
    warn(
      `Failed canceling deploy with id ${deployId}: ${
        error instanceof Error ? error.message : error?.toString() ?? ''
      }`,
    )
  }
}

const FIRST_PAGE = 1
const MAX_PAGES = 10
const MAX_PER_PAGE = 100

export const listSites = async ({
  api,
  options,
}: {
  api: NetlifyAPI
  // FIXME(serhalp): `page` and `maxPages` are missing from `netlify` package types
  options: Parameters<typeof api.listSites>[0] & { page?: number; maxPages?: number }
}): Promise<SiteInfo[]> => {
  const { maxPages = MAX_PAGES, page = FIRST_PAGE, ...rest } = options
  const sites = await api.listSites({ page, per_page: MAX_PER_PAGE, ...rest })
  // TODO: use pagination headers when js-client returns them
  if (sites.length === MAX_PER_PAGE && page + 1 <= maxPages) {
    // FIXME(serhalp): `id` and `name` should be required in `netlify` package type
    return [
      ...sites,
      ...(await listSites({ api, options: { page: page + 1, maxPages, ...rest } })),
    ] as unknown[] as SiteInfo[]
  }
  // FIXME(serhalp): See above
  return sites as unknown[] as SiteInfo[]
}

export const fetchAIGatewayToken = async ({ api, siteId }: { api: NetlifyAPI; siteId: string }): Promise<AIGatewayTokenResponse | null> => {
  try {
    const url = `${api.scheme}://${api.host}/api/v1/sites/${siteId}/ai-gateway/token`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${api.accessToken ?? ''}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`HTTP ${String(response.status)}: ${response.statusText}`)
    }
    
    const data: unknown = await response.json()
    
    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid response: not an object')
    }
    
    const responseData = data as Record<string, unknown>
    
    if (typeof responseData.token !== 'string' || typeof responseData.url !== 'string') {
      throw new Error('Invalid response: missing token or url')
    }
    
    return {
      token: responseData.token,
      url: responseData.url,
    }
  } catch (error) {
    warn(
      `Failed to fetch AI Gateway token for site ${siteId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    return null
  }
}
