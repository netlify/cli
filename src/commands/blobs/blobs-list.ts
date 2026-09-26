import { getStore, type GetStoreOptions } from '@netlify/blobs'
import AsciiTable from 'ascii-table'

import { chalk, logAndThrowError, log, logJson } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'
import type { BlobsListOptionValues } from './option_values.js'

export const blobsList = async (storeName: string, options: BlobsListOptionValues, command: BaseCommand) => {
  const { api, siteInfo } = command.netlify
  const store = getStore({
    apiURL: `${api.scheme}://${api.host}`,
    name: storeName,
    region: options.region as GetStoreOptions['region'],
    siteID: siteInfo.id,
    token: api.accessToken ?? '',
  })

  try {
    const { blobs, directories } = await store.list({
      directories: Boolean(options.directories),
      prefix: options.prefix,
    })

    if (options.json) {
      logJson({ blobs, directories })
      return
    }

    if (blobs.length === 0 && directories.length === 0) {
      log(`Netlify Blobs store ${chalk.yellow(storeName)} is empty`)
      return
    }

    const table = new AsciiTable(`Netlify Blobs (${storeName})`)

    table.setHeading('Key', 'ETag')

    directories.forEach((directory) => {
      table.addRow(directory, '(directory)')
    })

    blobs.forEach((blob) => {
      table.addRow(blob.key, blob.etag)
    })

    log(table.toString())
  } catch {
    return logAndThrowError(`Could not list blobs from store ${chalk.yellow(storeName)}`)
  }
}
