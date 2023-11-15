import { getStore } from '@netlify/blobs'

import { chalk, error as printError } from '../../utils/command-helpers.mjs'
import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs'

/**
 * The blobs:delete command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
const blobsDelete = async (storeName: string, key: string, _options: Record<string, unknown>, command) => {
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

/**
 * Creates the `netlify blobs:delete` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createBlobsDeleteCommand = (program) =>
  program
    .command('blobs:delete')
    .description(`(Beta) Deletes an object with a given key from a Netlify Blobs, if one exists`)
    .argument('<store>', 'Name of the store')
    .argument('<key>', 'Object key')
    .alias('blob:delete')
    .hook('preAction', requiresSiteInfo)
    .action(blobsDelete)
