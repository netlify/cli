import { getStore } from '@netlify/blobs'

import { picocolors, error as printError, log } from '../../utils/command-helpers.js'
import { promptBlobDelete } from '../../utils/prompts/blob-delete-prompts.js'

/**
 * The blobs:delete command
 */
export const blobsDelete = async (storeName: string, key: string, _options: Record<string, unknown>, command: any) => {
  const { api, siteInfo } = command.netlify
  const { force } = _options

  const store = getStore({
    apiURL: `${api.scheme}://${api.host}`,
    name: storeName,
    siteID: siteInfo.id ?? '',
    token: api.accessToken ?? '',
  })

  if (force === undefined) {
    await promptBlobDelete(key, storeName)
  }

  try {
    await store.delete(key)

    log(
      `${picocolors.greenBright('Success')}: Blob ${picocolors.yellow(key)} deleted from store ${picocolors.yellow(
        storeName,
      )}`,
    )
  } catch {
    return printError(`Could not delete blob ${picocolors.yellow(key)} from store ${picocolors.yellow(storeName)}`)
  }
}
