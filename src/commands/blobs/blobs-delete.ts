import { getStore } from '@netlify/blobs'

import { chalk, error as printError, log } from '../../utils/command-helpers.js'
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

    log(`${chalk.greenBright('Success')}: Blob ${chalk.yellow(key)} deleted from store ${chalk.yellow(storeName)}`)
  } catch {
    return printError(`Could not delete blob ${chalk.yellow(key)} from store ${chalk.yellow(storeName)}`)
  }
}
