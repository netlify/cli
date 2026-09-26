import { promises as fs } from 'fs'
import { resolve } from 'path'

import { getStore, type GetStoreOptions } from '@netlify/blobs'

import { chalk, logAndThrowError, log } from '../../utils/command-helpers.js'
import { promptBlobSetOverwrite } from '../../utils/prompts/blob-set-prompt.js'
import type BaseCommand from '../base-command.js'
import type { BlobsSetOptionValues } from './option_values.js'
import { isErrnoException } from '../../utils/errors.js'

export const blobsSet = async (
  storeName: string,
  key: string,
  valueParts: string[],
  options: BlobsSetOptionValues,
  command: BaseCommand,
) => {
  const { api, siteInfo } = command.netlify
  const { force, input } = options
  const store = getStore({
    apiURL: `${api.scheme}://${api.host}`,
    name: storeName,
    region: options.region as GetStoreOptions['region'],
    siteID: siteInfo.id,
    token: api.accessToken ?? '',
  })
  let value: string | ArrayBuffer = valueParts.join(' ')

  if (input) {
    const inputPath = resolve(input)
    try {
      value = new Uint8Array(await fs.readFile(inputPath)).buffer
    } catch (error) {
      if (isErrnoException(error) && error.code === 'ENOENT') {
        return logAndThrowError(
          `Could not set blob ${chalk.yellow(key)} because the file ${chalk.underline(inputPath)} does not exist`,
        )
      }

      if (isErrnoException(error) && error.code === 'EISDIR') {
        return logAndThrowError(
          `Could not set blob ${chalk.yellow(key)} because the path ${chalk.underline(inputPath)} is a directory`,
        )
      }

      return logAndThrowError(
        `Could not set blob ${chalk.yellow(key)} because the path ${chalk.underline(inputPath)} could not be read`,
      )
    }
  } else if (!value) {
    return logAndThrowError(
      `You must provide a value as a command-line parameter (e.g. 'netlify blobs:set my-store my-key my value') or specify the path to a file from where the value should be read (e.g. 'netlify blobs:set my-store my-key --input ./my-file.txt')`,
    )
  }

  if (force === undefined) {
    const existingValue = await store.get(key)

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- FIXME(@netlify/blobs): `Store.get` overloads omit `null` for missing keys
    if (existingValue) {
      await promptBlobSetOverwrite(key, storeName)
    }
  }

  try {
    await store.set(key, value)
    log(`${chalk.greenBright('Success')}: Blob ${chalk.yellow(key)} set in store ${chalk.yellow(storeName)}`)
  } catch {
    return logAndThrowError(`Could not set blob ${chalk.yellow(key)} in store ${chalk.yellow(storeName)}`)
  }
}
