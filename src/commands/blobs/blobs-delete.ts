import { getStore, type GetStoreOptions } from '@netlify/blobs'

import { chalk, logAndThrowError, log } from '../../utils/command-helpers.js'
import { promptBlobDelete } from '../../utils/prompts/blob-delete-prompts.js'
import type BaseCommand from '../base-command.js'
import type { BlobsDeleteOptionValues } from './option_values.js'

/**
 * The blobs:delete command
 */
export const blobsDelete = async (
  storeName: string,
  key: string,
  options: BlobsDeleteOptionValues,
  command: BaseCommand,
) => {
  const { api, siteInfo } = command.netlify
  const { force } = options

  const store = getStore({
    apiURL: `${api.scheme}://${api.host}`,
    name: storeName,
    region: options.region as GetStoreOptions['region'],
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- FIXME: `siteInfo.id` is typed as always set
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
    return logAndThrowError(`Could not delete blob ${chalk.yellow(key)} from store ${chalk.yellow(storeName)}`)
  }
}
