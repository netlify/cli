import { getStore } from '@netlify/blobs'

import { chalk, error as printError } from '../../utils/command-helpers.js'

/**
 * The blobs:delete command
 */
export const blobsDelete = async (storeName: string, key: string, _options: Record<string, unknown>, command: any) => {
  const { api, siteInfo } = command.netlify
  const store = getStore({
    apiURL: `${api.scheme}://${api.host}`,
    name: storeName,
    siteID: siteInfo.id ?? '',
    token: api.accessToken ?? '',
  })

  try {
    await store.delete(key)
  } catch {
    return printError(`Could not delete blob ${chalk.yellow(key)} from store ${chalk.yellow(storeName)}`)
  }
}
