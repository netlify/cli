import type { Project } from '@netlify/build-info'
import isEmpty from 'lodash/isEmpty.js'
import type { NetlifySite } from '../commands/types.js'
import type { SiteInfo } from '../utils/types.js'

export const packagesThatNeedSites = new Set(['@netlify/neon'])

export type DoesProjectRequireLinkedSiteParams = {
  project: Project
  site: NetlifySite
  siteInfo: SiteInfo
  options: Record<string, unknown>
}

export const doesProjectRequireLinkedSite = async ({
  options,
  project,
  site,
  siteInfo,
}: DoesProjectRequireLinkedSiteParams): Promise<[boolean, string[]]> => {
  // If we don't have a site, these extensions need one initialized
  const hasSiteData = Boolean(site.id || options.site) && !isEmpty(siteInfo)
  if (hasSiteData) {
    return [false, []]
  }
  const packageJson = await project.getPackageJSON()
  const dependencies = packageJson.dependencies ?? {}
  const packageNames = Object.keys(dependencies).filter((packageName) => packagesThatNeedSites.has(packageName))
  return [packageNames.length > 0, packageNames]
}
