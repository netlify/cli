import type { NetlifyAPI } from '@netlify/api'

import { logAndThrowError } from './command-helpers.js'
import type { SiteInfo } from './types.js'
import { getErrorMessage, isAPIError } from './errors.js'

export const getSiteByName = async (api: NetlifyAPI, siteName: string): Promise<SiteInfo> => {
  try {
    const sites = await api.listSites({ name: siteName, filter: 'all' })
    const siteFoundByName = sites.find((filteredSite) => filteredSite.name === siteName)

    if (!siteFoundByName) {
      throw new Error(`Project "${siteName}" cannot be found`)
    }

    // FIXME(serhalp): `id` and `name` should be required in `netlify` package type
    return siteFoundByName as SiteInfo
  } catch (error_) {
    if (isAPIError(error_) && error_.status === 401) {
      return logAndThrowError(`${getErrorMessage(error_)}: could not retrieve project`)
    } else {
      return logAndThrowError('Project not found. Please rerun "netlify link"')
    }
  }
}
