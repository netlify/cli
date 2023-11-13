// @ts-check
import { getStore } from '@netlify/blobs'
import AsciiTable from 'ascii-table'

import { chalk, error as printError, log, logJson } from '../../utils/command-helpers.mjs'
import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs'

/**
 * The blobs:list command
 * @param {string} storeName
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const blobsList = async (storeName, options, command) => {
  const { api, siteInfo } = command.netlify
  const store = getStore({
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

    const table = new AsciiTable(`Netlify Blobs (${storeName})`, {})

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
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createBlobsListCommand = (program) =>
  program
    .command('blobs:list')
    .description(
      `(Beta) Reads an object with a given key from a Netlify Blobs store and, if it exists, prints the content to the terminal or saves it to a file`,
    )
    .argument('<store>', 'Name of the store')
    .option(
      '-d, --directories',
      `Indicates that keys with the '/' character should be treated as directories, returning a list of sub-directories at a given level rather than all the keys inside them`,
    )
    .option(
      '-p, --prefix <prefix>',
      `A string for filtering down the entries; when specified, only the entries whose key starts with that prefix are returned`,
    )
    .option(
      '-d, --directories',
      `Indicates that keys with the '/' character should be treated as directories, returning a list of sub-directories at a given level rather than all the keys inside them`,
    )
    .option('--json', `Output list contents as JSON`)
    .alias('blob:list')
    .hook('preAction', requiresSiteInfo)
    .action(blobsList)
