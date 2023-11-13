// @ts-check
import { promises as fs } from 'fs'
import { resolve } from 'path'

import { getStore } from '@netlify/blobs'

import { chalk, error as printError } from '../../utils/command-helpers.mjs'
import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs'

/**
 * The blobs:set command
 * @param {string} storeName
 * @param {string} key
 * @param {string[]} valueParts
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
// eslint-disable-next-line max-params
const blobsSet = async (storeName, key, valueParts, options, command) => {
  const { api, siteInfo } = command.netlify
  const { input } = options
  const store = getStore({
    name: storeName,
    siteID: siteInfo.id ?? '',
    token: api.accessToken ?? '',
  })

  let value = valueParts.join(' ')

  if (input) {
    const inputPath = resolve(input)

    try {
      value = await fs.readFile(inputPath, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') {
        return printError(
          `Could not set blob ${chalk.yellow(key)} because the file ${chalk.underline(inputPath)} does not exist`,
        )
      }

      if (error.code === 'EISDIR') {
        return printError(
          `Could not set blob ${chalk.yellow(key)} because the path ${chalk.underline(inputPath)} is a directory`,
        )
      }

      return printError(
        `Could not set blob ${chalk.yellow(key)} because the path ${chalk.underline(inputPath)} could not be read`,
      )
    }
  } else if (!value) {
    return printError(
      `You must provide a value as a command-line parameter (e.g. 'netlify blobs:set my-store my-key my value') or specify the path to a file from where the value should be read (e.g. 'netlify blobs:set my-store my-key --input ./my-file.txt')`,
    )
  }

  try {
    await store.set(key, value)
  } catch {
    return printError(`Could not set blob ${chalk.yellow(key)} in store ${chalk.yellow(storeName)}`)
  }
}

/**
 * Creates the `netlify blobs:set` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createBlobsSetCommand = (program) =>
  program
    .command('blobs:set')
    .description(
      `(Beta) Writes to a Netlify Blobs store an object with the data provided in the command or the contents of a file defined by the 'input' parameter`,
    )
    .argument('<store>', 'Name of the store')
    .argument('<key>', 'Object key')
    .argument('[value...]', 'Object key')
    .option('-i, --input <path>', 'Defines the filesystem path where the blob data should be read from')
    .alias('blob:set')
    .hook('preAction', requiresSiteInfo)
    .action(blobsSet)
