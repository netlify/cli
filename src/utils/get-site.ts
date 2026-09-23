import type { NetlifyAPI } from '@netlify/api'

import { findSiteByName } from '../lib/api.js'
import { type APIError, logAndThrowError } from './command-helpers.js'
import type { SiteInfo } from './types.js'

export const getSiteByName = async (api: NetlifyAPI, siteName: string): Promise<SiteInfo> => {
  try {
    const siteFoundByName = await findSiteByName(api, siteName)

    if (!siteFoundByName) {
      throw new Error(`Project "${siteName}" cannot be found`)
    }

    return siteFoundByName
  } catch (error_) {
    if ((error_ as APIError).status === 401) {
      return logAndThrowError(`${(error_ as APIError).message}: could not retrieve project`)
    } else {
      return logAndThrowError('Project not found. Please rerun "netlify link"')
    }
  }
}
