import { promises as fs } from 'fs'
import { resolve } from 'path'

import { getStore } from '@netlify/blobs'
import { OptionValues } from 'commander'

import { chalk } from '../../utils/command-helpers.js'
import { NetlifyLog } from '../../utils/styles/index.js'
import BaseCommand from '../base-command.js'

interface Options extends OptionValues {
  output?: string
}

export const blobsGet = async (storeName: string, key: string, options: Options, command: BaseCommand) => {
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
    return NetlifyLog.error(`Could not retrieve blob ${chalk.yellow(key)} from store ${chalk.yellow(storeName)}`)
  }

  if (blob === null) {
    return NetlifyLog.error(`Blob ${chalk.yellow(key)} does not exist in store ${chalk.yellow(storeName)}`)
  }

  if (output) {
    const path = resolve(output)

    await fs.writeFile(path, blob)
  } else {
    console.log(blob)
  }
}
