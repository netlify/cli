import { getStore } from '@netlify/blobs'
import AsciiTable from 'ascii-table'

import { chalk, error as printError, log, logJson } from '../../utils/command-helpers.js'
import requiresSiteInfo from '../../utils/hooks/requires-site-info.js'

interface Options {
  directories?: boolean
  json?: boolean
  prefix?: string
}

const blobsList = async (storeName: string, options: Options, command: any) => {
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
    return printError(`Could not list blobs from store ${chalk.yellow(storeName)}`)
  }
}

/**
 * Creates the `netlify blobs:list` command
 */
export const createBlobsListCommand = (program: any) =>
  program
    .command('blobs:list')
    .description(`(Beta) Lists objects in a Netlify Blobs store`)
    .argument('<store>', 'Name of the store')
    .option(
      '-d, --directories',
      `Indicates that keys with the '/' character should be treated as directories, returning a list of sub-directories at a given level rather than all the keys inside them`,
    )
    .option(
      '-p, --prefix <prefix>',
      `A string for filtering down the entries; when specified, only the entries whose key starts with that prefix are returned`,
    )
    .option('--json', `Output list contents as JSON`)
    .alias('blob:list')
    .hook('preAction', requiresSiteInfo)
    .action(blobsList)
