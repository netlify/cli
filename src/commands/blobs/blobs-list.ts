import { getStore } from '@netlify/blobs'
import AsciiTable from 'ascii-table'
import { OptionValues } from 'commander'

import { chalk, log, logJson } from '../../utils/command-helpers.js'
import { intro, outro, log as NetlifyLog } from '../../utils/styles/index.js'
import BaseCommand from '../base-command.js'

interface Options extends OptionValues {
  directories?: boolean
  json?: boolean
  prefix?: string
}

export const blobsList = async (storeName: string, options: Options, command: BaseCommand) => {
  const { api, siteInfo } = command.netlify
  const store = getStore({
    apiURL: `${api.scheme}://${api.host}`,
    name: storeName,
    siteID: siteInfo?.id ?? '',
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

    intro('blobs:list')

    const table = new AsciiTable(`Netlify Blobs (${storeName})`)

    table.setHeading('Key', 'ETag')

    directories.forEach((directory) => {
      table.addRow(directory, '(directory)')
    })

    blobs.forEach((blob) => {
      table.addRow(blob.key, blob.etag)
    })

    log(table.toString())

    outro()

  } catch {
    return NetlifyLog.error(`Could not list blobs from store ${chalk.yellow(storeName)}`)
  }
}
