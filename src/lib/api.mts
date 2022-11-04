// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'warn'.
const { warn } = require('../utils/command-helpers.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'cancelDepl... Remove this comment to see the full error message
const cancelDeploy = async ({
  api,
  deployId
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  try {
    await api.cancelSiteDeploy({ deploy_id: deployId })
  } catch (error) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    warn(`Failed canceling deploy with id ${deployId}: ${(error as $TSFixMe).message}`);
  }
}

const FIRST_PAGE = 1
const MAX_PAGES = 10
const MAX_PER_PAGE = 100
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'listSites'... Remove this comment to see the full error message
const listSites = async ({
  api,
  options
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const { page = FIRST_PAGE, maxPages = MAX_PAGES, ...rest } = options
  const sites = await api.listSites({ page, per_page: MAX_PER_PAGE, ...rest })
  // TODO: use pagination headers when js-client returns them
  if (sites.length === MAX_PER_PAGE && page + 1 <= maxPages) {
    return [...sites, ...(await listSites({ api, options: { page: page + 1, maxPages, ...rest } }))]
  }
  return sites
}

module.exports = { cancelDeploy, listSites }
