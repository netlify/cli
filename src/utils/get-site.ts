import { error } from './command-helpers.js'

// @ts-expect-error TS(7006) FIXME: Parameter 'api' implicitly has an 'any' type.
export const getSiteByName = async (api, siteName) => {
  try {
    const sites = await api.listSites({ name: siteName, filter: 'all' })
    // @ts-expect-error TS(7006) FIXME: Parameter 'filteredSite' implicitly has an 'any' t... Remove this comment to see the full error message
    const siteFoundByName = sites.find((filteredSite) => filteredSite.name === siteName)

    if (!siteFoundByName) {
      throw Error
    }

    return siteFoundByName
  } catch (error_) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    if (error_.status === 401) {
      // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
      error(`${error_.message}: could not retrieve site`)
    } else {
      error('Site not found. Please rerun "netlify link"')
    }
  }
}
