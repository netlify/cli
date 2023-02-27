import { warn } from '../utils/command-helpers.mjs'

export const cancelDeploy = async ({ api, deployId }) => {
  try {
    await api.cancelSiteDeploy({ deploy_id: deployId })
  } catch (error) {
    warn(`Failed canceling deploy with id ${deployId}: ${error.message}`)
  }
}

const FIRST_PAGE = 1
const MAX_PAGES = 10
const MAX_PER_PAGE = 100
export const listSites = async ({ api, options }) => {
  const { maxPages = MAX_PAGES, page = FIRST_PAGE, ...rest } = options
  const sites = await api.listSites({ page, per_page: MAX_PER_PAGE, ...rest })
  // TODO: use pagination headers when js-client returns them
  if (sites.length === MAX_PER_PAGE && page + 1 <= maxPages) {
    return [...sites, ...(await listSites({ api, options: { page: page + 1, maxPages, ...rest } }))]
  }
  return sites
}
