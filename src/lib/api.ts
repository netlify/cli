import type { NetlifyAPI } from 'netlify'

import { warn } from '../utils/command-helpers.js'
import type { SiteInfo } from '../utils/types.js'

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
  // FIXME(serhalp) -- @ndhoule fixplz ayy lmao (`page` and `maxPages` are missing)
  options: Parameters<typeof api.listSites>[0] & { page?: number; maxPages?: number }
}): Promise<SiteInfo[]> => {
  const { maxPages = MAX_PAGES, page = FIRST_PAGE, ...rest } = options
  const sites = await api.listSites({ page, per_page: MAX_PER_PAGE, ...rest })
  // TODO: use pagination headers when js-client returns them
  if (sites.length === MAX_PER_PAGE && page + 1 <= maxPages) {
    // FIXME(serhalp) - @ndhoule fixplz ayy lmao (`id` and `name` should be required)
    return [
      ...sites,
      ...(await listSites({ api, options: { page: page + 1, maxPages, ...rest } })),
    ] as unknown[] as SiteInfo[]
  }
  // FIXME(serhalp) - @ndhoule fixplz ayy lmao (`id` and `name` should be required)
  return sites as unknown[] as SiteInfo[]
}
