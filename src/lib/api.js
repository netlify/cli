const { warn } = require('../utils/command-helpers')

const cancelDeploy = async ({ api, deployId }) => {
  try {
    await api.cancelSiteDeploy({ deploy_id: deployId })
  } catch (error) {
    warn(`Failed canceling deploy with id ${deployId}: ${error.message}`)
  }
}

const FIRST_PAGE = 1
const MAX_PAGES = 10
const MAX_PER_PAGE = 100
const listSites = async ({ api, options }) => {
  const { page = FIRST_PAGE, maxPages = MAX_PAGES, ...rest } = options
  const sites = await api.listSites({ page, per_page: MAX_PER_PAGE, ...rest })
  // TODO: use pagination headers when js-client returns them
  if (sites.length === MAX_PER_PAGE && page + 1 <= maxPages) {
    return [...sites, ...(await listSites({ api, options: { page: page + 1, maxPages, ...rest } }))]
  }
  return sites
}

module.exports = { cancelDeploy, listSites }
