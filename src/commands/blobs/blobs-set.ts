import { promises as fs } from 'fs'
import { resolve } from 'path'

import { getStore } from '@netlify/blobs'
import { OptionValues } from 'commander'

import { chalk, logAndThrowError, isNodeError, log } from '../../utils/command-helpers.js'
import { promptBlobSetOverwrite } from '../../utils/prompts/blob-set-prompt.js'
import BaseCommand from '../base-command.js'

interface Options extends OptionValues {
  input?: string
  force?: string | boolean
}

export const blobsSet = async (
  storeName: string,
  key: string,
  valueParts: string[],
  options: Options,
  command: BaseCommand,
) => {
  const { api, siteInfo } = command.netlify
  const { force, input } = options
  const store = getStore({
    apiURL: `${api.scheme}://${api.host}`,
    name: storeName,
    siteID: siteInfo.id,
    token: api.accessToken ?? '',
  })
  let value: string | ArrayBuffer = valueParts.join(' ')

  if (input) {
    const inputPath = resolve(input)
    try {
      value = await fs.readFile(inputPath)
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return logAndThrowError(
          `Could not set blob ${chalk.yellow(key)} because the file ${chalk.underline(inputPath)} does not exist`,
        )
      }

      if (isNodeError(error) && error.code === 'EISDIR') {
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

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
