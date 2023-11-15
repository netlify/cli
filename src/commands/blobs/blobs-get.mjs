// @ts-check
import { promises as fs } from 'fs'
import { resolve } from 'path'

import { getStore } from '@netlify/blobs'

import { chalk, error as printError } from '../../utils/command-helpers.mjs'
import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs'

/**
 * The blobs:get command
 * @param {string} storeName
 * @param {string} key
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const blobsGet = async (storeName, key, options, command) => {
  const { api, siteInfo } = command.netlify
  const { output } = options
  const store = getStore({
    apiURL: `${api.scheme}://${api.host}`,
    name: storeName,
    siteID: siteInfo?.id ?? '',
    token: api.accessToken ?? '',
  })

  let blob

  try {
    blob = await store.get(key)
  } catch {
    return printError(`Could not retrieve blob ${chalk.yellow(key)} from store ${chalk.yellow(storeName)}`)
  }

  if (blob === null) {
    return printError(`Blob ${chalk.yellow(key)} does not exist in store ${chalk.yellow(storeName)}`)
  }

  if (output) {
    const path = resolve(output)

    await fs.writeFile(path, blob)
  } else {
    console.log(blob)
  }
}

/**
 * Creates the `netlify blobs:get` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createBlobsGetCommand = (program) =>
  program
    .command('blobs:get')
    .description(
      `(Beta) Reads an object with a given key from a Netlify Blobs store and, if it exists, prints the content to the terminal or saves it to a file`,
    )
    .argument('<store>', 'Name of the store')
    .argument('<key>', 'Object key')
    .option('-o, --output <path>', 'Defines the filesystem path where the blob data should be persisted')
    .alias('blob:get')
    .hook('preAction', requiresSiteInfo)
    .action(blobsGet)
