import type { NetlifyAPI } from '@netlify/api'

import type { CachedConfig } from '../../lib/build.js'
import type { SiteInfo } from '../../utils/types.js'

export const fetchSiteInfo = async (api: NetlifyAPI, siteId: string): Promise<SiteInfo> =>
  // FIXME(@netlify/api): `getSite` response type doesn't match the hand-written `SiteInfo` (e.g. optional `account_slug`)
  (await api.getSite({ siteId })) as unknown as SiteInfo

export const getSiteInfo = async (api: NetlifyAPI, siteId: string, cachedConfig: CachedConfig): Promise<SiteInfo> => {
  const { siteInfo: cachedSiteInfo } = cachedConfig
  if (siteId !== cachedSiteInfo.id) {
    return await fetchSiteInfo(api, siteId)
  }
  return cachedSiteInfo
}
