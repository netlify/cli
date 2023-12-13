import { promises as fs } from 'fs'
import { resolve } from 'path'

import { getStore } from '@netlify/blobs'
import { OptionValues } from 'commander'

import { chalk, isNodeError } from '../../utils/command-helpers.js'
import { intro, NetlifyLog, outro, spinner } from '../../utils/styles/index.js'
import BaseCommand from '../base-command.js'

interface Options extends OptionValues {
  input?: string
}

export const blobsSet = async (
  storeName: string,
  key: string,
  valueParts: string[],
  options: Options,
  command: BaseCommand,
) => {
  intro('blobs:set')
  const { api, siteInfo } = command.netlify
  const { input } = options
  const store = getStore({
    apiURL: `${api.scheme}://${api.host}`,
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
      if (isNodeError(error) && error.code === 'ENOENT') {
        return NetlifyLog.error(
          `Could not set blob ${chalk.yellow(key)} because the file ${chalk.underline(inputPath)} does not exist`,
        )
      }

      if (isNodeError(error) && error.code === 'EISDIR') {
        return NetlifyLog.error(
          `Could not set blob ${chalk.yellow(key)} because the path ${chalk.underline(inputPath)} is a directory`,
        )
      }

      return NetlifyLog.error(
        `Could not set blob ${chalk.yellow(key)} because the path ${chalk.underline(inputPath)} could not be read`,
      )
    }
  } else if (!value) {
    return NetlifyLog.error(
      `You must provide a value as a command-line parameter (e.g. 'netlify blobs:set my-store my-key my value') or specify the path to a file from where the value should be read (e.g. 'netlify blobs:set my-store my-key --input ./my-file.txt')`,
    )
  }

  try {
    const blobSpinner = spinner()
		blobSpinner.start(`Setting ${chalk.yellow(key)} in store ${chalk.yellow(storeName)}`);
    await store.set(key, value)
		blobSpinner.stop(`Blob ${chalk.yellow(key)} set in store ${chalk.yellow(storeName)}`);
    outro()
  } catch {
    return NetlifyLog.error(`Could not set blob ${chalk.yellow(key)} in store ${chalk.yellow(storeName)}`)
  }
}
