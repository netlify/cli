import { getStore } from '@netlify/blobs'

import { chalk } from '../../utils/command-helpers.js'
import { NetlifyLog, intro, outro } from '../../utils/styles/index.js'

/**
 * The blobs:delete command
 */
export const blobsDelete = async (storeName: string, key: string, _options: Record<string, unknown>, command: any) => {
  const { api, siteInfo } = command.netlify
  intro('blobs:delete')
  const store = getStore({
    apiURL: `${api.scheme}://${api.host}`,
    name: storeName,
    siteID: siteInfo.id ?? '',
    token: api.accessToken ?? '',
  })

  try {
    await store.delete(key)
    NetlifyLog.success(`Deleted blob ${chalk.yellow(key)} from store ${chalk.yellow(storeName)}`)
    outro()
  } catch {
    return NetlifyLog.error(`Could not delete blob ${chalk.yellow(key)} from store ${chalk.yellow(storeName)}`)
  }
}
