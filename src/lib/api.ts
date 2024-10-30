import { warn } from '../utils/command-helpers.js'
import { ExtendedNetlifyAPI } from '../types/api/api.js'
import { SiteInfo } from '../types/api/sites.js'
import { OptionValues } from 'commander'

export const cancelDeploy = async ({ api, deployId }: { api: ExtendedNetlifyAPI, deployId: string }) => {
  try {
    await api.cancelSiteDeploy({ deploy_id: deployId })
  } catch (error) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    warn(`Failed canceling deploy with id ${deployId}: ${error.message}`)
  }
}

const FIRST_PAGE = 1
const MAX_PAGES = 10
const MAX_PER_PAGE = 100


export const listSites = async ({ api, options }: { api: ExtendedNetlifyAPI, options: OptionValues }): Promise<SiteInfo[]> => {
  const { maxPages = MAX_PAGES, page = FIRST_PAGE, ...rest } = options
  const sites = await api.listSites({ page, per_page: MAX_PER_PAGE, ...rest })
  // TODO: use pagination headers when js-client returns them
  if (sites.length === MAX_PER_PAGE && page + 1 <= maxPages) {
    return [...sites, ...(await listSites({ api, options: { page: page + 1, maxPages, ...rest } }))]
  }
  return sites
}
