import type { NetlifyAPI } from '@netlify/api'
import type { OptionValues } from 'commander'

import type { CachedConfig } from '../../lib/build.js'
import { exit, logJson } from '../../utils/command-helpers.js'
import type { SiteInfo } from '../../utils/types.js'
import type BaseCommand from '../base-command.js'

export const getSiteInfo = async (api: NetlifyAPI, siteId: string, cachedConfig: CachedConfig): Promise<SiteInfo> => {
  const { siteInfo: cachedSiteInfo } = cachedConfig
  if (siteId !== cachedSiteInfo.id) {
    return (await api.getSite({ siteId })) as unknown as SiteInfo
  }
  return cachedSiteInfo
}

export const getEnvSiteId = (options: OptionValues, command: BaseCommand): string | undefined =>
  options.site ? command.netlify.siteInfo.id : command.netlify.site.id

export const failNotLinked = (
  options: OptionValues,
  message = 'No project id found, please run inside a project folder or `netlify link`',
): never => {
  if (options.json) {
    logJson({ error: { code: 'NOT_LINKED', message, fix: 'netlify link' } })
  } else {
    process.stderr.write(`${message}\n`)
  }
  return exit(1)
}
