import type { NetlifyAPI } from '@netlify/api'

import type { CachedConfig } from '../../lib/build.js'
import type { SiteInfo } from '../../utils/types.js'

export const getSiteInfo = async (api: NetlifyAPI, siteId: string, cachedConfig: CachedConfig): Promise<SiteInfo> => {
  const { siteInfo: cachedSiteInfo } = cachedConfig
  if (siteId !== cachedSiteInfo.id) {
    return (await api.getSite({ siteId })) as unknown as SiteInfo
  }
  return cachedSiteInfo
}
