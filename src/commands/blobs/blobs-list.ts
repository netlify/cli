import { getStore } from '@netlify/blobs'
import AsciiTable from 'ascii-table'
import { OptionValues } from 'commander'

import { chalk, logAndThrowError, log, logJson } from '../../utils/command-helpers.js'
import { netlifyFetchForOrigin } from '../../utils/netlify-fetch.js'
import BaseCommand from '../base-command.js'

interface Options extends OptionValues {
  directories?: boolean
  json?: boolean
  prefix?: string
}

export const blobsList = async (storeName: string, options: Options, command: BaseCommand) => {
  const { api, siteInfo } = command.netlify
  const apiURL = `${api.scheme}://${api.host}`
  const store = getStore({
    apiURL,
    fetch: netlifyFetchForOrigin(apiURL),
    name: storeName,
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
