import { error } from './command-helpers.mjs'

export const getSiteByName = async (api, siteName) => {
  try {
    const sites = await api.listSites({ name: siteName, filter: 'all' })
    const siteFoundByName = sites.find((filteredSite) => filteredSite.name === siteName)

    if (!siteFoundByName) {
      throw Error
    }

    return siteFoundByName
  } catch {
    error('Site not found. Please rerun "netlify link"')
  }
}
