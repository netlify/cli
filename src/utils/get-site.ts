import type { NetlifyAPI } from '@netlify/api'

import { type APIError, logAndThrowError } from './command-helpers.js'
import type { SiteInfo } from './types.js'

export const getSiteByName = async (api: NetlifyAPI, siteName: string): Promise<SiteInfo> => {
  try {
    const sites = await api.listSites({ name: siteName, filter: 'all' })
    const siteFoundByName = sites.find((filteredSite) => filteredSite.name === siteName)

    if (!siteFoundByName) {
      throw new Error(`Site "${siteName}" cannot be found`)
    }

    // FIXME(serhalp): `id` and `name` should be required in `netlify` package type
    return siteFoundByName as SiteInfo
  } catch (error_) {
    if ((error_ as APIError).status === 401) {
      return logAndThrowError(`${(error_ as APIError).message}: could not retrieve site`)
    } else {
      return logAndThrowError('Site not found. Please rerun "netlify link"')
    }
  }
}
